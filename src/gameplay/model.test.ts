import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { CAMPAIGN_LENGTH, encounterProgress, generateRun, parseSave, radiationDamage } from './model';
test('seeded routes are reproducible with reachable boss and extraction', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const rooms = generateRun(seed);
    assert.deepEqual(rooms, generateRun(seed));
    assert.equal(rooms.length, CAMPAIGN_LENGTH);
    assert.equal(rooms[0].kind, 'start');
    assert.equal(rooms.at(-2)!.kind, 'boss');
    assert.equal(rooms.at(-1)!.kind, 'exit');
    assert.equal(rooms.filter(r => r.kind === 'trader').length, 3);
    rooms.forEach((r, i) => assert.equal(r.id, i));
    const arenas = rooms.filter(r => r.kind === 'boss');
    assert.deepEqual(arenas.map(r => r.bosses.length), [1, 1, 2, 2, 3, 3]);
    for (const arena of arenas) assert.equal(new Set(arena.bosses).size, arena.bosses.length);
    for (const act of [1, 2, 3]) {
      const chapter = rooms.filter(r => r.act === act && r.kind !== 'start' && r.kind !== 'exit');
      assert.equal(chapter.length, 8);
      assert.equal(chapter[4].kind, 'trader');
      assert.equal(chapter[7].kind, 'boss');
      assert.ok(chapter.filter(r => r.kind === 'combat').every(r => r.waves >= act));
    }
  }
});
test('radiation damage is independent of update frequency', () => {
  const at30 = Array.from({ length: 30 }, () => radiationDamage(80, 1 / 30)).reduce((a, b) => a + b, 0);
  const at144 = Array.from({ length: 144 }, () => radiationDamage(80, 1 / 144)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(at30 - at144) < 1e-10);
  assert.equal(radiationDamage(50, 10), 0);
});
test('save reader rejects corrupt and unsupported data and bounds progression', () => {
  assert.equal(parseSave('broken').credits, 0);
  assert.equal(parseSave('{"version":2,"credits":500}').credits, 0);
  assert.deepEqual(parseSave('{"version":1,"credits":-4,"level":999,"best":100,"runs":"hi"}'), { version: 1, credits: 0, level: 5, best: CAMPAIGN_LENGTH, runs: 0 });
});

test('multi-wave sectors never clear early or while a boss remains alive', () => {
  const rooms = generateRun(42);
  const longRoom = rooms.find(r => r.kind === 'combat' && r.act === 3)!;
  assert.equal(encounterProgress(longRoom, 1, 0), 'next-wave');
  assert.equal(encounterProgress(longRoom, longRoom.waves, 1), 'fighting');
  assert.equal(encounterProgress(longRoom, longRoom.waves, 0), 'cleared');
  const finalBoss = rooms.at(-2)!;
  assert.equal(encounterProgress(finalBoss, 1, 2), 'fighting');
  assert.equal(encounterProgress(finalBoss, 1, 1), 'fighting');
  assert.equal(encounterProgress(finalBoss, 1, 0), 'cleared');
});
test('existing ten-sector saves retain progress and accept extended campaign records', () => {
  const old = parseSave('{"version":1,"credits":72,"level":2,"best":10,"runs":3}');
  assert.equal(old.best, 10); assert.equal(old.credits, 72); assert.equal(old.level, 2);
  assert.equal(parseSave(JSON.stringify({ ...old, best: 25 })).best, 25);
});
