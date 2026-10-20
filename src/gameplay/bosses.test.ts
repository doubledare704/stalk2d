import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { bosses, bossVolley } from './bosses';

test('bosses have distinct ring, fan, and melee attack patterns', () => {
  const ring = bossVolley('warden', 0, 0);
  assert.equal(ring.length, 10);
  assert.ok(Math.abs(ring[1].angle - Math.PI / 5) < 1e-10);
  const fan = bossVolley('oracle', 1, 0);
  assert.equal(fan.length, 5);
  assert.equal(fan[2].angle, 1);
  assert.ok(fan.every(s => Math.abs(s.angle - 1) <= .31));
  assert.equal(bossVolley('ravager', 0, 0).length, 0);
  assert.ok(bosses.ravager.speed > bosses.warden.speed);
});
