import Phaser from 'phaser';
import { bosses, bossVolley } from '../gameplay/bosses';
import { hasLineOfSight, leadAngle, pursuitWaypoint, sentinel, type Point } from '../gameplay/enemies';
import { CAMPAIGN_LENGTH, chapters, encounterProgress, artifacts, generateRun, parseSave, radiationDamage, random, weapons, type BossId, type Room, type Save, type WeaponId } from '../gameplay/model';

type Enemy = { x: number; y: number; hp: number; max: number; kind: number; cooldown: number; hit: number; phase: number; aimAngle: number; aiming: boolean; burst: number; burstDelay: number; navMs: number; waypoint?: Point; boss?: BossId; charge: number };
type Bullet = { x: number; y: number; vx: number; vy: number; life: number; damage: number; hostile: boolean };
type Hazard = { x: number; y: number; kind: number; phase: number; cooldown: number };
type Pickup = { x: number; y: number; kind: 'cash' | 'med' | 'anti'; value: number };
const roomNames = { start: 'ВХІДНИЙ ШЛЮЗ', combat: 'СЕКТОР ЗАЧИСТКИ', anomaly: 'АНОМАЛЬНЕ ПОЛЕ', trader: 'БЕЗПЕЧНИЙ ВУЗОЛ', boss: 'СЕРЦЕ ЛАБОРАТОРІЇ', exit: 'ТОЧКА ЕВАКУАЦІЇ' };
const C = { lime: 0xbcc67a, muted: 0x7b8c6b, red: 0xcf765c, cyan: 0x77c7b9 };
export class ZoneScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private labelCursor = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private save: Save = parseSave(null);
  private wave = 0; private waveDelay = 0;
  private previewSector = import.meta.env.DEV ? Math.max(0, Math.min(CAMPAIGN_LENGTH - 2, Math.floor(Number(new URLSearchParams(location.search).get('encounter')) || 0))) : 0;
  private rooms: Room[] = []; private roomIndex = 0; private seed = 0;
  private player = { x: 180, y: 430 }; private hp = 100; private maxHp = 100; private radiation = 0;
  private speed = 1; private damage = 1; private credits = 0; private kills = 0; private elapsed = 0;
  private meds = 2; private antirads = 2; private weapon: WeaponId = 'pistol';
  private ammo: Record<WeaponId, number> = { pistol: 12, shotgun: 6, rifle: 30 };
  private unlocked: WeaponId[] = ['pistol']; private collected: string[] = [];
  private enemies: Enemy[] = []; private bullets: Bullet[] = []; private hazards: Hazard[] = []; private pickups: Pickup[] = [];
  private walls: { x: number; y: number; w: number; h: number }[] = [];
  private mode: 'menu' | 'playing' | 'paused' | 'choice' | 'trader' | 'result' = 'menu';
  private shot = 0; private reload = 0; private hurt = 0; private transition = 0; private emission = 0; private emissionCycle = -1;
  private notice = ''; private noticeUntil = 0; private audio?: AudioContext; private soundOn = false; private geiger = 0;
  private overlay!: HTMLElement;
  constructor() { super('Zone'); }
  create() {
    this.g = this.add.graphics();
    this.overlay = document.querySelector('#overlay')!;
    try { this.save = parseSave(localStorage.getItem('zona-save')); } catch { /* Storage can be unavailable. */ }
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,R,Q,F,E,ESC,ONE,TWO,THREE,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.mouse!.disableContextMenu();
    document.querySelector('#sound')!.addEventListener('click', () => { this.soundOn = !this.soundOn; if (this.soundOn) { this.audio ??= new AudioContext(); void this.audio.resume(); } document.querySelector('#sound')!.textContent = this.soundOn ? 'ЗВУК: УВІМК.' : 'ЗВУК: ВИМК.'; });
    window.addEventListener('blur', () => { if (this.mode === 'playing') this.pause(); });
    this.seed = 80421; this.rooms = generateRun(this.seed); this.enterRoom(0); this.showMenu();
  }
  private persist() { if (this.previewSector > 0) return; try { localStorage.setItem('zona-save', JSON.stringify(this.save)); } catch { this.notify('Сховище недоступне — прогрес лише в цій сесії'); } }
  private panel(html: string) { this.overlay.innerHTML = `<div class="panel">${html}</div>`; }
  private bind(id: string, action: () => void) { document.getElementById(id)?.addEventListener('click', action); }
  private showMenu() {
    this.mode = 'menu';
    this.panel(`<div class="eyebrow">ПРИП’ЯТЬ / ЗАКРИТИЙ СЕКТОР / 03:47</div><h1>ОСТАННІЙ<br>СИГНАЛ<span style="color:#b8c16c">.</span></h1><p>Під землею досі працює передавач. Пройди крізь лабораторію, знайди джерело сигналу та повернись живим.</p><div class="actions"><button class="primary" id="start">${this.previewSector > 0 ? `ТЕСТ СЕКТОРА ${this.previewSector + 1}` : 'ПОЧАТИ ЕКСПЕДИЦІЮ ↗'}</button><button id="upgrade" ${this.previewSector > 0 || this.save.level >= 5 || this.save.credits < (this.save.level + 1) * 40 ? 'disabled' : ''}>ВИТРИВАЛІСТЬ +10 / ${(this.save.level + 1) * 40} ₴</button></div><div class="stats"><div><strong>${this.save.credits} ₴</strong><span>СХОВАНКА</span></div><div><strong>${this.save.level} / 5</strong><span>ПІДГОТОВКА</span></div><div><strong>${this.save.best} / ${CAMPAIGN_LENGTH}</strong><span>НАЙКРАЩИЙ МАРШРУТ</span></div></div><p class="small">${CAMPAIGN_LENGTH} секторів · 3 глави · 6 арен босів · одна спроба · збереження покращень після смерті<br>WASD — рух · миша — вогонь · E — шлюз / взаємодія</p>`);
    this.bind('start', () => this.startRun()); this.bind('upgrade', () => { const cost = (this.save.level + 1) * 40; if (this.save.level < 5 && this.save.credits >= cost) { this.save.credits -= cost; this.save.level++; this.persist(); this.showMenu(); } });
  }
  private startRun() {
    this.seed = Math.floor(Math.random() * 999999); this.rooms = generateRun(this.seed); this.hp = this.maxHp = 100 + this.save.level * 10;
    this.radiation = 0; this.speed = this.damage = 1; this.credits = this.kills = this.elapsed = 0; this.meds = this.antirads = 2;
    this.weapon = 'pistol'; this.ammo = { pistol: 12, shotgun: 6, rifle: 30 }; this.unlocked = ['pistol']; this.collected = [];
    this.shot = this.reload = this.hurt = this.emission = 0; this.emissionCycle = -1; this.mode = 'playing'; this.overlay.innerHTML = ''; if (this.previewSector > 0 && this.previewSector < CAMPAIGN_LENGTH - 1) { this.unlocked = ['pistol', 'shotgun', 'rifle']; this.weapon = 'rifle'; }
    this.enterRoom(Math.max(0, Math.min(CAMPAIGN_LENGTH - 2, this.previewSector)));
    this.notify('Сигнал знайдено. Дістанься до передавача.');
  }
  private enterRoom(index: number) {
    this.roomIndex = index; this.player = { x: 160, y: 440 }; this.bullets = []; this.enemies = []; this.hazards = []; this.pickups = []; this.reload = 0; this.transition = 650; this.wave = 0; this.waveDelay = 0;
    const room = this.rooms[index]; const rng = random(room.seed);
    this.walls = [{ x: 370, y: 300, w: 110, h: 65 }, { x: 760, y: 525, w: 140, h: 65 }];
    if (room.kind === 'boss') this.walls = [{ x: 440, y: 290, w: 60, h: 85 }, { x: 440, y: 535, w: 60, h: 85 }];
    if (room.kind === 'start' || room.kind === 'trader' || room.kind === 'exit') this.walls = [];
    if (room.kind === 'combat' || room.kind === 'boss') this.spawnWave();
    if (room.kind === 'anomaly' || room.kind === 'combat' && index > 2) {
      for (let i = 0; i < (room.kind === 'anomaly' ? 5 + room.act : 2); i++) this.hazards.push({ x: 350 + rng() * 650, y: 250 + rng() * 370, kind: i % 2, phase: rng() * 4, cooldown: 0 });
    }
    if (room.kind === 'trader') room.cleared = true;
    this.notify(`${String(index + 1).padStart(2, '0')} / ${roomNames[room.kind]}`);
  }
  private spawnWave() {
    const room = this.rooms[this.roomIndex];
    this.wave++; this.waveDelay = 0;
    const rng = random(room.seed + this.wave * 7919);
    const count = room.kind === 'boss' ? room.bosses.length : Math.min(8, 2 + room.act + this.wave);
    for (let i = 0; i < count; i++) {
      const boss = room.bosses[i];
      const kind = room.kind === 'boss' ? 3 : i === 0 || room.act >= 2 && i === 1 ? 4 : Math.floor(rng() * 3);
      const max = kind === 3 ? bosses[boss].hp + (room.act - 1) * 100 : kind === 4 ? sentinel.baseHp + room.act * 24 : 50 + kind * 15 + room.act * 12;
      let x = 650 + rng() * 430, y = 245 + rng() * 360;
      let attempts = 0;
      while ((this.blocked(x, y, kind === 3 ? 36 : 25) || Math.hypot(x - this.player.x, y - this.player.y) < 220 || this.enemies.some(e => Math.hypot(e.x - x, e.y - y) < 85)) && attempts++ < 150) {
        x = 170 + rng() * 920; y = 245 + rng() * 360;
      }
      this.enemies.push({ x, y, kind, hp: max, max, cooldown: 1400 + i * 550 + rng() * 600, hit: 0, phase: rng() * 6,
        aimAngle: 0, aiming: false, burst: 0, burstDelay: 0, navMs: 0, boss: kind === 3 ? boss : undefined, charge: 0 });
    }
    if (room.kind === 'combat') this.notify(`ХВИЛЯ ${this.wave} / ${room.waves} — ТРИМАЙ ПОЗИЦІЮ`);
  }
  private notify(text: string) { this.notice = text; this.noticeUntil = this.time.now + 4000; }
  private tone(freq: number, duration = .06, type: OscillatorType = 'square', volume = .025) {
    if (!this.soundOn || !this.audio) return;
    const o = this.audio.createOscillator(), gain = this.audio.createGain(); o.type = type; o.frequency.value = freq; gain.gain.setValueAtTime(volume, this.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, this.audio.currentTime + duration); o.connect(gain); gain.connect(this.audio.destination); o.start(); o.stop(this.audio.currentTime + duration);
  }
  private blocked(x: number, y: number, r = 13) { return x < 99 + r || x > 1181 - r || y < 200 + r || y > 695 - r || this.walls.some(w => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h); }
  private move(entity: { x: number; y: number }, dx: number, dy: number, r = 13) { if (!this.blocked(entity.x + dx, entity.y, r)) entity.x += dx; if (!this.blocked(entity.x, entity.y + dy, r)) entity.y += dy; }
  private takeDamage(n: number) { if (this.hurt > 0) return; this.hp -= n; this.hurt = 800; this.tone(65, .15, 'sawtooth'); if (this.hp <= 0) this.finish(false); }
  private pause() { this.mode = 'paused'; this.panel('<div class="eyebrow">ЗВ’ЯЗОК ПРИЗУПИНЕНО</div><h2>ПАУЗА</h2><p>Зона зачекає.</p><div class="actions"><button class="primary" id="resume">ПРОДОВЖИТИ</button><button id="abandon">ЗАВЕРШИТИ ВИЛАЗКУ</button></div>'); this.bind('resume', () => this.resume()); this.bind('abandon', () => this.finish(false)); }
  private resume() { this.mode = 'playing'; this.overlay.innerHTML = ''; }
  private artifactChoice() {
    this.mode = 'choice'; const rng = random(this.rooms[this.roomIndex].seed + 8); const first = Math.floor(rng() * artifacts.length); const choices = [first, (first + 2) % artifacts.length, (first + 4) % artifacts.length];
    this.panel(`<div class="eyebrow">КОНТЕЙНЕР ВІДКРИТО / ВИБЕРИ ОДИН</div><h2>ДАРУНОК ЗОНИ</h2>${choices.map((id, i) => `<div class="offer"><div><strong>${artifacts[id].name}</strong><p>${artifacts[id].description}</p></div><button id="artifact${i}">ВЗЯТИ ↗</button></div>`).join('')}<p class="small">Ефекти накопичуються до кінця експедиції.</p>`);
    choices.forEach((id, i) => this.bind(`artifact${i}`, () => { const a = artifacts[id]; this.maxHp = Math.max(30, this.maxHp + a.hp); this.hp = Phaser.Math.Clamp(this.hp + Math.max(0, a.hp), 1, this.maxHp); this.speed = Math.max(.5, this.speed + a.speed); this.damage = Math.max(.25, this.damage + a.damage); this.radiation = Phaser.Math.Clamp(this.radiation + a.radiation, 0, 100); this.collected.push(a.name); this.resume(); this.notify(`Артефакт: ${a.name}`); }));
  }
  private trader() {
    this.mode = 'trader';
    const offers: { title: string; detail: string; cost: number; action: () => void; disabled?: boolean }[] = [
      { title: 'ОБРІЗ', detail: '6 дробин · ближній бій', cost: 35, disabled: this.unlocked.includes('shotgun'), action: () => { this.unlocked.push('shotgun'); this.weapon = 'shotgun'; } },
      { title: 'АВТОМАТ', detail: '30 набоїв · автоматичний вогонь', cost: 55, disabled: this.unlocked.includes('rifle'), action: () => { this.unlocked.push('rifle'); this.weapon = 'rifle'; } },
      { title: 'ПОЛЬОВИЙ КОМПЛЕКТ', detail: '+1 аптечка · +1 антирад', cost: 20, action: () => { this.meds++; this.antirads++; } },
      { title: 'МЕДИЧНА ДОПОМОГА', detail: 'Повне здоров’я · очищення радіації', cost: 25, action: () => { this.hp = this.maxHp; this.radiation = 0; } },
    ];
    this.panel(`<div class="eyebrow">БЕЗПЕЧНИЙ ВУЗОЛ / ТОРГОВЕЦЬ</div><h2>ПРИПАСИ <span style="color:#b8c16c">${this.credits} ₴</span></h2>${offers.map((o, i) => `<div class="offer"><div><strong>${o.title}</strong><p>${o.detail}</p></div><button id="buy${i}" ${o.disabled || this.credits < o.cost ? 'disabled' : ''}>${o.disabled ? 'ПРИДБАНО' : `${o.cost} ₴`}</button></div>`).join('')}<div class="actions"><button id="leave" class="primary">ПРОДОВЖИТИ МАРШРУТ →</button></div>`);
    offers.forEach((o, i) => this.bind(`buy${i}`, () => { if (!o.disabled && this.credits >= o.cost) { this.credits -= o.cost; o.action(); this.trader(); } })); this.bind('leave', () => this.resume());
  }
  private finish(won: boolean) {
    if (this.mode === 'result') return;
    this.mode = 'result'; const earned = Math.floor(this.kills * 4 + this.roomIndex * 6 + (won ? 80 : 0)); if (this.previewSector === 0) { this.save.credits += earned; this.save.runs++; this.save.best = Math.max(this.save.best, this.roomIndex + 1); this.persist(); }
    this.panel(`<div class="eyebrow">${won ? 'ПЕРЕДАВАЧ ВИМКНЕНО / ЕВАКУАЦІЯ УСПІШНА' : 'СИГНАЛ ВТРАЧЕНО / ЕКСПЕДИЦІЮ ЗАВЕРШЕНО'}</div><h1>${won ? 'ТИ ПОВЕРНУВСЯ.' : 'ЗОНА ЗАБРАЛА<br>СВОЄ.'}</h1><p>${won ? 'Лабораторія замовкла. Але десь у темряві вже прокидається новий сигнал.' : 'Підготовка зберігається. Наступного разу ти зайдеш далі.'}</p><div class="stats"><div><strong>${this.kills}</strong><span>ЗНИЩЕНО</span></div><div><strong>${this.roomIndex + 1}/${this.rooms.length}</strong><span>СЕКТОР</span></div><div><strong>+${this.previewSector > 0 ? 0 : earned} ₴</strong><span>У СХОВАНКУ</span></div></div><div class="actions"><button class="primary" id="again">ЩЕ ОДНА ЕКСПЕДИЦІЯ ↗</button><button id="menu">ДО СХОВАНКИ</button></div>`);
    this.bind('again', () => this.startRun()); this.bind('menu', () => this.showMenu());
  }
  update(_time: number, delta: number) {
    const dt = Math.min(delta, 50) / 1000; const ms = dt * 1000; const pressed = (k: string) => Phaser.Input.Keyboard.JustDown(this.keys[k]);
    if (pressed('ESC')) { if (this.mode === 'playing') this.pause(); else if (this.mode === 'paused') this.resume(); }
    if (this.mode === 'playing') {
      this.elapsed += dt; this.shot -= ms; this.hurt -= ms; this.transition -= ms;
      if (this.reload > 0) { this.reload -= ms; if (this.reload <= 0) { this.ammo[this.weapon] = weapons[this.weapon].magazine; this.tone(500); } }
      const x = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
      const y = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
      const previousPosition = { ...this.player };
      const length = Math.hypot(x, y) || 1; this.move(this.player, x / length * 195 * this.speed * dt, y / length * 195 * this.speed * dt);
      if (pressed('R') && this.reload <= 0 && this.ammo[this.weapon] < weapons[this.weapon].magazine) this.reload = weapons[this.weapon].reload;
      (['ONE', 'TWO', 'THREE'] as const).forEach((key, i) => { const id = (['pistol', 'shotgun', 'rifle'] as WeaponId[])[i]; if (pressed(key) && this.unlocked.includes(id)) { this.weapon = id; this.reload = 0; } });
      if (pressed('Q') && this.meds > 0 && this.hp < this.maxHp) { this.meds--; this.hp = Math.min(this.maxHp, this.hp + 45); this.notify('Аптечка: +45 здоров’я'); this.tone(440, .2, 'sine'); }
      if (pressed('F') && this.antirads > 0 && this.radiation > 0) { this.antirads--; this.radiation = Math.max(0, this.radiation - 45); this.notify('Антирад: −45 радіації'); }
      const pointer = this.input.activePointer;
      if (pointer.isDown && this.shot <= 0 && this.reload <= 0 && this.transition <= 0) {
        const w = weapons[this.weapon]; if (this.ammo[this.weapon] <= 0) this.reload = w.reload;
        else { this.ammo[this.weapon]--; this.shot = w.interval; const angle = Math.atan2(pointer.y - this.player.y, pointer.x - this.player.x);
          for (let i = 0; i < w.pellets; i++) { const a = angle + (Math.random() - .5) * w.spread * 2; this.bullets.push({ x: this.player.x + Math.cos(angle) * 23, y: this.player.y + Math.sin(angle) * 23, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: .9, damage: w.damage * this.damage, hostile: false }); }
          this.tone(this.weapon === 'shotgun' ? 90 : 150, .065, 'sawtooth'); }
      }
      const velocity = { x: (this.player.x - previousPosition.x) / Math.max(dt, .001), y: (this.player.y - previousPosition.y) / Math.max(dt, .001) };
      for (const e of this.enemies) {
        if (e.kind === 4) { this.updateSentinel(e, dt, velocity); continue; }
        if (e.kind === 3) { this.updateBoss(e, dt); continue; }
        e.cooldown -= ms; e.hit -= ms; e.phase += dt; const a = Math.atan2(this.player.y - e.y, this.player.x - e.x), distance = Phaser.Math.Distance.Between(e.x, e.y, this.player.x, this.player.y);
        const speed = e.kind === 1 ? (e.cooldown < 350 ? 260 : 75) : e.kind === 2 ? (distance > 300 ? 65 : 0) : 95;
        const step = Math.min(speed * dt, Math.max(0, distance - 27));
        this.move(e, Math.cos(a) * step, Math.sin(a) * step, 16);
        if (distance < 29) this.takeDamage(12);
        if (e.cooldown <= 0) { e.cooldown = e.kind === 2 ? 2100 : 1800;
          if (e.kind === 2) this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 4, damage: 14, hostile: true });
        }
      }
      const activeBosses = this.enemies.filter(e => e.boss);
      for (let i = 0; i < activeBosses.length; i++) for (let j = i + 1; j < activeBosses.length; j++) {
        const a = activeBosses[i], b = activeBosses[j];
        const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
        const spacing = bosses[a.boss!].size + bosses[b.boss!].size + 8;
        if (distance < spacing) {
          const nx = distance > .01 ? dx / distance : 1, ny = distance > .01 ? dy / distance : 0;
          const push = (spacing - distance) / 2;
          this.move(a, -nx * push, -ny * push, bosses[a.boss!].size + 1);
          this.move(b, nx * push, ny * push, bosses[b.boss!].size + 1);
        }
      }
      if (this.mode !== 'playing') { this.renderWorld(); return; }
      for (const b of this.bullets) {
        b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (this.blocked(b.x, b.y, 2)) b.life = 0;
        if (b.life <= 0) continue;
        if (b.hostile) { if (Phaser.Math.Distance.Between(b.x, b.y, this.player.x, this.player.y) < 17) { this.takeDamage(b.damage); b.life = 0; } }
        else { const target = this.enemies.find(e => e.hp > 0 && Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < (e.boss ? bosses[e.boss].size + 5 : 20)); if (target) { target.hp -= b.damage; target.hit = 100; b.life = 0; if (target.hp <= 0) { this.kills++; this.pickups.push({ x: target.x, y: target.y, kind: 'cash', value: target.kind === 3 ? 80 : target.kind === 4 ? 24 : 12 }); this.tone(240, .08, 'triangle'); } } }
      }
      this.bullets = this.bullets.filter(b => b.life > 0); this.enemies = this.enemies.filter(e => e.hp > 0);
      for (const h of this.hazards) { h.phase += dt; h.cooldown -= ms; const d = Phaser.Math.Distance.Between(h.x, h.y, this.player.x, this.player.y); if (d < 85) this.radiation = Math.min(100, this.radiation + (1 - d / 85) * 7 * dt);
        if (d < 39 && h.phase % 3.6 > 2.3 && h.cooldown <= 0) { this.takeDamage(h.kind === 0 ? 18 : 12); h.cooldown = 1000; }
        if (d < 160 && this.geiger <= 0) { this.tone(900 + Math.random() * 700, .015, 'square', .015); this.geiger = d / 200 + .03; }
      }
      if (this.mode !== 'playing') { this.renderWorld(); return; }
      this.geiger -= dt; this.hp -= radiationDamage(this.radiation, dt); if (this.hp <= 0) this.finish(false);
      if (this.mode !== 'playing') { this.renderWorld(); return; }
      const cycle = Math.floor(this.elapsed / 90); const cycleTime = this.elapsed % 90;
      this.emission = cycleTime > 78 ? (cycleTime - 78) / 12 : 0;
      if (cycle > this.emissionCycle) { if (cycle > 0 && this.rooms[this.roomIndex].kind !== 'trader') { this.radiation = Math.min(100, this.radiation + 22); this.notify('Викид пройшов. Радіація +22.'); } this.emissionCycle = cycle; }
      this.pickups = this.pickups.filter(p => { if (Phaser.Math.Distance.Between(p.x, p.y, this.player.x, this.player.y) < 38) { if (p.kind === 'cash') this.credits += p.value; else if (p.kind === 'med') this.meds++; else this.antirads++; this.tone(600, .04, 'sine'); return false; } return true; });
      const room = this.rooms[this.roomIndex];
      if (this.mode === 'playing' && !room.cleared && (room.kind === 'combat' || room.kind === 'boss')) {
        const progress = encounterProgress(room, this.wave, this.enemies.length);
        if (progress === 'next-wave') {
          if (this.waveDelay === 0) { this.waveDelay = 2200; this.credits += 8; this.notify('ПІДКРІПЛЕННЯ НАБЛИЖАЄТЬСЯ…'); }
          else { this.waveDelay -= ms; if (this.waveDelay <= 0) this.spawnWave(); }
        } else if (progress === 'cleared') {
          room.cleared = true; this.credits += room.kind === 'boss' ? 40 * room.act : 15;
          this.meds += room.kind === 'boss' ? 2 : 1; this.antirads += 1;
          if (room.kind === 'boss') { this.hp = Math.min(this.maxHp, this.hp + 35); this.radiation = Math.max(0, this.radiation - 25); }
          if (!this.unlocked.includes('shotgun')) { this.unlocked.push('shotgun'); this.weapon = 'shotgun'; }
          if (this.roomIndex >= 4 && !this.unlocked.includes('rifle')) this.unlocked.push('rifle');
          this.artifactChoice();
        }
      }
      if (this.mode === 'playing' && room.kind === 'anomaly' && !room.cleared && this.player.x > 1020) { room.cleared = true; this.artifactChoice(); }
      if (pressed('E') && this.mode === 'playing') {
        if (room.kind === 'trader' && this.player.x > 490 && this.player.x < 800) this.trader();
        else if (this.player.x > 1090 && Math.abs(this.player.y - 440) < 100 && (room.cleared || room.kind === 'exit')) { if (room.kind === 'exit') this.finish(true); else this.enterRoom(this.roomIndex + 1); }
      }
    }
    this.renderWorld();
  }
  private updateBoss(enemy: Enemy, dt: number) {
    const definition = bosses[enemy.boss!];
    const ms = dt * 1000;
    enemy.hit -= ms; enemy.phase += dt; enemy.cooldown -= ms; enemy.navMs -= ms;
    const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
    const distance = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
    if (enemy.charge > 0) {
      enemy.charge -= ms;
      this.move(enemy, Math.cos(enemy.aimAngle) * 270 * dt, Math.sin(enemy.aimAngle) * 270 * dt, definition.size + 1);
    } else {
      if (!enemy.waypoint || enemy.navMs <= 0 || Math.hypot(enemy.x - enemy.waypoint.x, enemy.y - enemy.waypoint.y) < 5) {
        enemy.waypoint = pursuitWaypoint(enemy, this.player, this.walls, definition.size + 1); enemy.navMs = 350;
      }
      const dx = enemy.waypoint.x - enemy.x, dy = enemy.waypoint.y - enemy.y, d = Math.hypot(dx, dy);
      const step = Math.min(definition.speed * dt, d, Math.max(0, distance - definition.size - 15));
      if (d > 0) this.move(enemy, dx / d * step, dy / d * step, definition.size + 1);
      if (enemy.boss === 'ravager' && enemy.cooldown < 650 && enemy.cooldown > 180) enemy.aimAngle = angle;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = definition.cooldown;
        if (enemy.boss === 'ravager') enemy.charge = 450;
        else for (const shot of bossVolley(enemy.boss!, angle, enemy.phase)) this.bullets.push({ x: enemy.x, y: enemy.y,
          vx: Math.cos(shot.angle) * shot.speed, vy: Math.sin(shot.angle) * shot.speed, life: 5, damage: 15, hostile: true });
      }
    }
    if (distance < definition.size + 19) this.takeDamage(enemy.boss === 'ravager' ? 24 : 20);
  }
  private updateSentinel(enemy: Enemy, dt: number, playerVelocity: Point) {
    const ms = dt * 1000;
    enemy.hit -= ms; enemy.phase += dt; enemy.navMs -= ms;
    const distance = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
    const visible = distance <= sentinel.range && hasLineOfSight(enemy, this.player, this.walls, 3);
    enemy.aiming = false;
    if (!visible) {
      // Cover interrupts acquisition and the remainder of a burst.
      enemy.burst = 0;
      enemy.cooldown = Math.max(enemy.cooldown, sentinel.aimMs);
    } else if (enemy.burst > 0) {
      enemy.burstDelay -= ms;
      if (enemy.burstDelay <= 0) {
        const angle = enemy.aimAngle;
        this.bullets.push({ x: enemy.x + Math.cos(angle) * 23, y: enemy.y + Math.sin(angle) * 23,
          vx: Math.cos(angle) * sentinel.shotSpeed, vy: Math.sin(angle) * sentinel.shotSpeed,
          life: sentinel.range / sentinel.shotSpeed + .1, damage: sentinel.damage, hostile: true });
        enemy.burst--; enemy.burstDelay = sentinel.burstIntervalMs;
        this.tone(105, .07, 'sawtooth', .018);
        if (enemy.burst === 0) enemy.cooldown = sentinel.cycleMs;
      }
    } else {
      const previousCooldown = enemy.cooldown;
      enemy.cooldown -= ms;
      enemy.aiming = enemy.cooldown <= sentinel.aimMs;
      // Track until the final lock window; the complete burst uses this fixed aim.
      if (enemy.cooldown > sentinel.lockMs || previousCooldown > sentinel.lockMs) enemy.aimAngle = leadAngle(enemy, this.player, playerVelocity);
      if (enemy.cooldown <= 0) { enemy.aiming = false; enemy.burst = sentinel.burstShots; enemy.burstDelay = 0; }
    }
    if (!visible || distance > sentinel.preferredRange) {
      if (!enemy.waypoint || enemy.navMs <= 0 || Math.hypot(enemy.x - enemy.waypoint.x, enemy.y - enemy.waypoint.y) < 5) {
        enemy.waypoint = pursuitWaypoint(enemy, this.player, this.walls);
        enemy.navMs = 300;
      }
      const dx = enemy.waypoint.x - enemy.x, dy = enemy.waypoint.y - enemy.y;
      const remaining = Math.hypot(dx, dy);
      const step = Math.min(remaining, sentinel.speed * dt, Math.max(0, distance - 30));
      if (remaining > 0) this.move(enemy, dx / remaining * step, dy / remaining * step, 18);
    }
    if (distance < 32) this.takeDamage(16);
  }
  private text(x: number, y: number, value: string, size = 12, color = '#a6b18d', family = 'IBM Plex Mono, monospace') {
    let t = this.labels[this.labelCursor++];
    if (!t) { t = this.add.text(x, y, value, { fontFamily: family, fontSize: size, color }); this.labels.push(t); }
    if (t.text !== value) t.setText(value);
    t.setPosition(x, y).setVisible(true).setAngle(0);
    if (t.style.fontSize !== `${size}px` || t.style.fontFamily !== family || t.style.color !== color) t.setStyle({ fontFamily: family, fontSize: size, color });
    return t;
  }
  private renderWorld() {
    this.labelCursor = 0; const g = this.g; g.clear();
    const rect = (x: number, y: number, w: number, h: number, color: number, alpha = 1) => { g.fillStyle(color, alpha); g.fillRect(Math.round(x), Math.round(y), w, h); };
    rect(0, 0, 1280, 800, 0x101713); rect(0, 0, 1280, 125, 0x141d16); rect(0, 125, 1280, 1, 0x3c4933);
    this.text(36, 25, 'ОПЕРАЦІЯ / ОСТАННІЙ СИГНАЛ', 10, '#8b9a76'); this.text(36, 50, roomNames[this.rooms[this.roomIndex].kind], 27, '#d4dac1', 'Oswald, sans-serif');
    const min = String(Math.floor(this.elapsed / 60)).padStart(2, '0'), sec = String(Math.floor(this.elapsed % 60)).padStart(2, '0');
    this.text(1060, 29, `ЧАС  ${min}:${sec}`, 12); this.text(1060, 55, `СЕКТОР ${String(this.roomIndex + 1).padStart(2, '0')} / ${this.rooms.length}`, 12, '#d3d8b7');
    const chapterRooms = this.rooms.filter(r => r.act === this.rooms[this.roomIndex].act && r.kind !== 'start' && r.kind !== 'exit');
    chapterRooms.forEach((r, i) => { rect(460 + i * 42, 41, 30, 25, r.id === this.roomIndex ? C.lime : r.cleared ? 0x445434 : r.kind === 'boss' ? 0x573c30 : 0x263125); this.text(466 + i * 42, 47, r.kind === 'boss' ? 'Б' : String(r.id + 1), 10, r.id === this.roomIndex ? '#172015' : '#a3ac8a'); });
    this.text(460, 80, `ГЛАВА ${this.rooms[this.roomIndex].act} / 3 · ${chapters[this.rooms[this.roomIndex].act - 1]}`, 10);
    // Deterministic floor panels, cracks, moss, and industrial wall edging.
    rect(80, 180, 1120, 535, 0x293028); rect(94, 194, 1092, 507, 0x1b241d);
    for (let y = 200; y < 695; y += 48) for (let x = 100; x < 1180; x += 48) { const n = ((x * 17 + y * 31 + this.rooms[this.roomIndex].seed) % 19); rect(x, y, 46, 46, n < 5 ? 0x202b22 : n < 10 ? 0x1d271f : 0x222b22); if (n < 3) { rect(x + 8, y + 12, 18, 2, 0x30402b); rect(x + 12, y + 14, 2, 10, 0x30402b); } }
    for (let x = 100; x < 1180; x += 70) { rect(x, 180, 45, 9, 0x394334); rect(x, 706, 45, 9, 0x394334); }
    [210, 645, 1080].forEach(x => { rect(x, 184, 40, 4, C.lime); g.fillStyle(C.lime, .035); g.fillCircle(x + 20, 210, 110); });
    rect(84, 394, 12, 95, 0x596243); this.text(20, 430, 'ВХІД', 10, '#75866a').setAngle(-90);
    const room = this.rooms[this.roomIndex], open = room.cleared || room.kind === 'exit';
    rect(1186, 388, 14, 108, open ? C.lime : 0x8c4e3c); rect(1140, 389, 40, 105, open ? 0x34452d : 0x342921);
    for (let y = 393; y < 490; y += 15) rect(1150, y, 24, 3, open ? 0x718350 : 0x724d37);
    this.text(1090, 515, open ? '[E] ШЛЮЗ →' : 'ЗАБЛОКОВАНО', 10, open ? '#c8d688' : '#ae7660');
    for (const w of this.walls) { rect(w.x + 8, w.y + 8, w.w, w.h, 0x0c130e, .6); rect(w.x, w.y, w.w, w.h, 0x3a4535); rect(w.x + 4, w.y + 4, w.w - 8, w.h - 12, 0x303c2d); rect(w.x + 8, w.y + 8, w.w - 16, 3, 0x536044); for (let x = w.x + 12; x < w.x + w.w - 5; x += 18) rect(x, w.y + 20, 3, 22, 0x202c22); }
    if (room.kind === 'trader') { g.fillStyle(C.lime, .04); g.fillCircle(650, 430, 140); rect(600, 394, 85, 60, 0x4d5438); rect(615, 378, 45, 18, 0x7b8152); rect(630, 382, 15, 6, C.lime); this.text(547, 490, '[E] ТОРГІВЛЯ / БЕЗПЕЧНА ЗОНА', 12, '#c0cc8a'); }
    if (room.kind === 'start') { this.text(280, 380, 'НЕ ОЗИРАЙСЯ.', 25, '#68775b', 'Oswald'); this.text(280, 418, 'Рухайся до шлюзу →  [E]', 13, '#7d8e6b'); rect(830, 310, 60, 100, 0x303c2d); rect(838, 320, 44, 30, 0x0a1912); this.text(842, 328, 'X-08', 10, '#b5c779'); }
    if (room.kind === 'exit') { g.fillStyle(C.lime, .07); g.fillCircle(1110, 440, 160); this.text(450, 390, 'ПОВЕРТАЙСЯ НА ПОВЕРХНЮ.', 24, '#b6c17d', 'Oswald'); }
    for (const h of this.hazards) { const active = h.phase % 3.6 > 2.3, color = h.kind === 0 ? C.cyan : 0xd2a065; g.lineStyle(1, color, .25); g.strokeCircle(h.x, h.y, 45); g.fillStyle(color, active ? .19 : .05); g.fillCircle(h.x, h.y, active ? 40 : 28); g.lineStyle(active ? 2 : 1, color, active ? .8 : .35); g.strokeCircle(h.x, h.y, 17 + Math.sin(h.phase * 6) * 8); for (let i = 0; i < 5; i++) { const a = i * 1.25 + h.phase; rect(h.x + Math.cos(a) * 27, h.y + Math.sin(a) * 27, 3, 3, color, .8); } }
    for (const p of this.pickups) { g.fillStyle(C.lime, .06); g.fillCircle(p.x, p.y, 16); rect(p.x - 5, p.y - 5, 10, 10, C.lime); rect(p.x - 2, p.y - 3, 4, 6, 0x3c4a2c); }
    for (const e of this.enemies) { const size = e.boss ? bosses[e.boss].size : 15, color = e.hit > 0 ? 0xe8d7b2 : e.boss ? bosses[e.boss].color : [0x7e8060, 0x917761, 0x687d6b, 0x8e7964, 0x899b98][e.kind]; g.fillStyle(0x080c09, .5); g.fillEllipse(e.x + 4, e.y + size, size * 2.5, 13); rect(e.x - size, e.y - size, size * 2, size * 2, color); rect(e.x - size + 4, e.y - size - 5, size * 2 - 8, 10, color); rect(e.x - size - 4, e.y - 4, 6, 16, color); rect(e.x + size - 2, e.y - 4, 6, 16, color); rect(e.x - 8, e.y - 6, 5, 3, 0xe2ad77); rect(e.x + 4, e.y - 6, 5, 3, 0xe2ad77); rect(e.x - size, e.y - size - 14, size * 2, 3, 0x392e24); rect(e.x - size, e.y - size - 14, size * 2 * Math.max(0, e.hp / e.max), 3, C.red); if (e.kind === 1 && e.cooldown < 350) { g.lineStyle(1, C.red, .7); g.strokeCircle(e.x, e.y, 25); } }
    const livingBosses = this.enemies.filter(e => e.boss);
    livingBosses.forEach((enemy, i) => {
      const definition = bosses[enemy.boss!];
      const width = 290, x = 110 + i * 350;
      this.text(x, 641, `${definition.name} · ${Math.ceil(enemy.hp)} / ${enemy.max}`, 11, '#dcaa8b');
      rect(x, 662, width, 5, 0x392e24); rect(x, 662, width * Math.max(0, enemy.hp / enemy.max), 5, definition.color);
      if (enemy.boss === 'ravager' && (enemy.cooldown < 650 || enemy.charge > 0)) {
        g.lineStyle(2, C.red, .65); g.strokeCircle(enemy.x, enemy.y, 40);
        g.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(enemy.aimAngle) * 160, enemy.y + Math.sin(enemy.aimAngle) * 160);
      }
    });
    if (room.kind === 'combat') this.text(105, 130, `ХВИЛЯ ${this.wave} / ${room.waves} · ВОРОГІВ ${this.enemies.length}${this.waveDelay > 0 ? ` · ПІДКРІПЛЕННЯ ${Math.ceil(this.waveDelay / 1000)}с` : ''}`, 10);
    if (room.kind === 'boss') this.text(105, 130, `АРЕНА БОСІВ · ЗАЛИШИЛОСЬ ${livingBosses.length} / ${room.bosses.length}`, 10, '#d6a181');
    if (this.previewSector > 0) this.text(900, 130, 'ТЕСТ / ПРОГРЕС НЕ ЗБЕРІГАЄТЬСЯ', 9, '#cf9d70');
    for (const enemy of this.enemies.filter(e => e.kind === 4)) {
      const angle = enemy.aiming || enemy.burst > 0 ? enemy.aimAngle : Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      // Armored shoulders, dark helmet, cyan visor and a longer rifle silhouette.
      rect(enemy.x - 19, enemy.y - 8, 8, 20, 0x465a58);
      rect(enemy.x + 11, enemy.y - 8, 8, 20, 0x465a58);
      rect(enemy.x - 10, enemy.y - 20, 20, 14, 0x344541);
      rect(enemy.x - 7, enemy.y - 14, 14, 3, C.cyan);
      rect(enemy.x - 6, enemy.y + 1, 12, 10, 0x475a55);
      g.lineStyle(5, 0x17241f); g.lineBetween(enemy.x, enemy.y + 3, enemy.x + Math.cos(angle) * 29, enemy.y + Math.sin(angle) * 29);
      if (enemy.aiming) {
        const locked = enemy.cooldown <= sentinel.lockMs;
        const beamLength = Math.min(sentinel.range, Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y) + 90);
        g.lineStyle(locked ? 2 : 1, locked ? 0xf3a26b : C.red, locked ? .85 : .35);
        g.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(angle) * beamLength, enemy.y + Math.sin(angle) * beamLength);
        g.strokeCircle(enemy.x, enemy.y, 26);
      }
      this.text(enemy.x - 31, enemy.y - 44, sentinel.name, 9, '#a6c1b5');
    }
    const p = this.player, a = Math.atan2(this.input.activePointer.y - p.y, this.input.activePointer.x - p.x);
    g.fillStyle(0x080d09, .65); g.fillEllipse(p.x + 3, p.y + 17, 36, 15); rect(p.x - 10, p.y + 8, 7, 13, 0x303a2b); rect(p.x + 3, p.y + 8, 7, 13, 0x303a2b); rect(p.x - 13, p.y - 9, 26, 23, this.hurt > 0 ? 0xc5b09a : 0x829066); rect(p.x - 8, p.y - 19, 16, 15, 0xa0a779); rect(p.x - 7, p.y - 13, 14, 5, 0x1c2a21); rect(p.x - 3, p.y - 12, 3, 2, C.lime);
    g.lineStyle(7, 0x202a21); g.lineBetween(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, p.x + Math.cos(a) * 28, p.y + Math.sin(a) * 28); g.lineStyle(2, 0x77806a); g.lineBetween(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12 - 2, p.x + Math.cos(a) * 28, p.y + Math.sin(a) * 28 - 2);
    if (this.shot > weapons[this.weapon].interval - 65) { g.fillStyle(0xe9d79b, .9); g.fillCircle(p.x + Math.cos(a) * 32, p.y + Math.sin(a) * 32, 6); }
    for (const b of this.bullets) { g.lineStyle(b.hostile ? 4 : 2, b.hostile ? C.red : 0xe0d49b); g.lineBetween(b.x, b.y, b.x - b.vx * .014, b.y - b.vy * .014); }
    // Sparse foreground scanlines and vignette frame.
    for (let y = 180; y < 715; y += 4) rect(80, y, 1120, 1, 0x000000, .035);
    if (this.emission > 0) { rect(80, 180, 1120, 535, 0x8e281b, this.emission * .2); this.text(430, 155, `⚠ ВИКИД ЧЕРЕЗ ${Math.ceil(90 - this.elapsed % 90)} СЕК. / ШУКАЙ БЕЗПЕЧНИЙ ВУЗОЛ`, 12, '#da9c77'); }
    if (this.noticeUntil > this.time.now) this.text(105, 153, this.notice, 12, '#bdca8c');
    rect(0, 735, 1280, 65, 0x151e16); rect(0, 735, 1280, 1, 0x3c4933);
    this.text(30, 751, 'СТАН', 9, '#7c8a68'); this.text(30, 767, `${Math.ceil(Math.max(0, this.hp))} / ${this.maxHp}`, 17, '#cfd5b5'); rect(154, 765, 155, 8, 0x30392b); rect(154, 765, 155 * Math.max(0, this.hp / this.maxHp), 8, this.hp < 30 ? C.red : C.lime);
    this.text(340, 751, 'РАДІАЦІЯ', 9, '#7c8a68'); this.text(340, 768, `${Math.floor(this.radiation)}%`, 15, this.radiation > 50 ? '#d99169' : '#b3b99a'); rect(400, 771, 85, 4, 0x39402c); rect(400, 771, this.radiation * .85, 4, 0xcb9f62);
    this.text(520, 751, weapons[this.weapon].name, 10, '#bdc695'); this.text(520, 769, this.reload > 0 ? `ПЕРЕЗАРЯДКА ${(this.reload / 1000).toFixed(1)}` : `${this.ammo[this.weapon]} / ${weapons[this.weapon].magazine}    ∞ РЕЗЕРВ`, 13, '#d3d8b9');
    this.text(785, 751, `[Q] АПТЕЧКИ ${this.meds}   [F] АНТИРАД ${this.antirads}`, 10); this.text(785, 773, `АРТЕФАКТИ ${this.collected.length}   •   ЗНИЩЕНО ${this.kills}`, 9, '#7f8f6e');
    this.text(1115, 751, 'ПРИПАСИ', 9, '#7c8a68'); this.text(1115, 768, `${this.credits} ₴`, 18, '#c7d282');
    this.text(100, 721, `X-08 / ПІДЗЕМНИЙ КОМПЛЕКС`, 8, '#5e7158'); this.text(960, 721, `SEED ${this.seed} / ${this.unlocked.map(w => ({ pistol: '1 ПМ', shotgun: '2 ОБРІЗ', rifle: '3 АК' })[w]).join(' · ')}`, 8, '#6e7d5c');
    if (this.mode === 'playing') { const pointer = this.input.activePointer; g.lineStyle(1, C.lime, .8); g.strokeCircle(pointer.x, pointer.y, 7); g.lineBetween(pointer.x - 11, pointer.y, pointer.x - 4, pointer.y); g.lineBetween(pointer.x + 4, pointer.y, pointer.x + 11, pointer.y); g.lineBetween(pointer.x, pointer.y - 11, pointer.x, pointer.y - 4); g.lineBetween(pointer.x, pointer.y + 4, pointer.x, pointer.y + 11); }
    for (let i = this.labelCursor; i < this.labels.length; i++) this.labels[i].setVisible(false);
  }
}
