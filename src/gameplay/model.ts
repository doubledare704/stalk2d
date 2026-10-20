export type WeaponId = 'pistol' | 'shotgun' | 'rifle';
export const weapons = {
  pistol: { name: 'ПМ / ПІСТОЛЕТ', damage: 27, interval: 280, magazine: 12, reload: 1000, pellets: 1, spread: .025, speed: 650 },
  shotgun: { name: 'ОБРІЗ / ДРОБОВИК', damage: 16, interval: 750, magazine: 6, reload: 1500, pellets: 6, spread: .22, speed: 550 },
  rifle: { name: 'АК / АВТОМАТ', damage: 17, interval: 105, magazine: 30, reload: 1600, pellets: 1, spread: .065, speed: 800 },
} as const;
export const artifacts = [
  { name: 'КРОВОКАМІНЬ', description: '+30 здоров’я · −5% швидкості', hp: 30, speed: -.05, damage: 0, radiation: 0 },
  { name: 'СПАЛАХ', description: '+18% швидкості · +8 радіації', hp: 0, speed: .18, damage: 0, radiation: 8 },
  { name: 'ІКЛО', description: '+25% шкоди · −10 здоров’я', hp: -10, speed: 0, damage: .25, radiation: 0 },
  { name: 'МЕДУЗА', description: '−25 радіації · −5% шкоди', hp: 0, speed: 0, damage: -.05, radiation: -25 },
  { name: 'СЕРЦЕ ЗОНИ', description: '+15 здоров’я · +10% шкоди · +12 радіації', hp: 15, speed: 0, damage: .1, radiation: 12 },
  { name: 'ПЕРO', description: '+10% швидкості · −5 здоров’я', hp: -5, speed: .1, damage: 0, radiation: 0 },
];
export type RoomKind = 'start' | 'combat' | 'anomaly' | 'trader' | 'boss' | 'exit';
export type BossId = 'warden' | 'ravager' | 'oracle';
export const CAMPAIGN_LENGTH = 26;
export const chapters = ['ЗОВНІШНІЙ КОМПЛЕКС', 'ГЛИБИННІ ЛАБОРАТОРІЇ', 'ЯДРО ЗОНИ'];
export interface Room { id: number; kind: RoomKind; cleared: boolean; seed: number; act: number; waves: number; bosses: BossId[] }
export function random(seed: number) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function generateRun(seed: number): Room[] {
  const rng = random(seed);
  const route: { kind: RoomKind; act: number; waves: number; bosses: BossId[] }[] = [{ kind: 'start', act: 1, waves: 0, bosses: [] }];
  const bossTypes: BossId[] = ['warden', 'ravager', 'oracle'];
  for (let act = 1; act <= 3; act++) {
    const opening: RoomKind[] = ['combat', 'anomaly', 'combat'];
    if (rng() < .5) [opening[0], opening[1]] = [opening[1], opening[0]];
    const kinds: RoomKind[] = [...opening, 'boss', 'trader', 'combat', 'anomaly', 'boss'];
    kinds.forEach((kind, slot) => {
      const offset = (act - 1 + (slot === 7 ? 1 : 0)) % bossTypes.length;
      route.push({ kind, act, waves: kind === 'combat' ? act + (slot === 5 ? 1 : 0) : kind === 'boss' ? 1 : 0,
        bosses: kind === 'boss' ? Array.from({ length: act }, (_, i) => bossTypes[(offset + i) % bossTypes.length]) : [] });
    });
  }
  route.push({ kind: 'exit', act: 3, waves: 0, bosses: [] });
  return route.map((room, id) => ({ ...room, id, cleared: room.kind === 'start', seed: Math.floor(rng() * 1e9) }));
}

// Used by gameplay and tests: no exit/reward until the final wave is actually dead.
export function encounterProgress(room: Room, wave: number, living: number): 'fighting' | 'next-wave' | 'cleared' {
  if (living > 0) return 'fighting';
  return wave < room.waves ? 'next-wave' : 'cleared';
}
export interface Save { version: 1; credits: number; level: number; best: number; runs: number }
export function parseSave(raw: string | null): Save {
  const fallback: Save = { version: 1, credits: 0, level: 0, best: 0, runs: 0 };
  try { const s = JSON.parse(raw ?? 'null'); if (s?.version !== 1) return fallback;
    return { version: 1, credits: safe(s.credits, 999999), level: safe(s.level, 5), best: safe(s.best, CAMPAIGN_LENGTH), runs: safe(s.runs, 999999) };
  } catch { return fallback; }
}
function safe(n: unknown, max: number) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0; }
export function radiationDamage(radiation: number, seconds: number) { return radiation > 50 ? (radiation - 50) / 15 * seconds : 0; }
