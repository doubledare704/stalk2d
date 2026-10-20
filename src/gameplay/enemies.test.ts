import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { hasLineOfSight, leadAngle, pursuitWaypoint, sentinel } from './enemies';

test('cover blocks sight including edge hits, but leaves parallel clear shots open', () => {
  const walls = [{ x: 370, y: 300, w: 110, h: 65 }];
  assert.equal(hasLineOfSight({ x: 200, y: 330 }, { x: 600, y: 330 }, walls), false);
  assert.equal(hasLineOfSight({ x: 200, y: 300 }, { x: 600, y: 300 }, walls), false);
  assert.equal(hasLineOfSight({ x: 200, y: 280 }, { x: 600, y: 280 }, walls), true);
  assert.equal(hasLineOfSight({ x: 400, y: 210 }, { x: 400, y: 600 }, walls), false);
});

test('focused pursuit routes a full body around cover instead of sticking to it', () => {
  const walls = [{ x: 370, y: 300, w: 110, h: 65 }];
  let position = { x: 550, y: 330 };
  const target = { x: 200, y: 330 };
  for (let i = 0; i < 1000 && Math.hypot(position.x - target.x, position.y - target.y) > 2; i++) {
    const next = pursuitWaypoint(position, target, walls);
    const distance = Math.hypot(next.x - position.x, next.y - position.y);
    assert.ok(distance > 0, 'must continue pursuing rather than getting stuck');
    const step = Math.min(distance, sentinel.speed / 30);
    const moved = { x: position.x + (next.x - position.x) / distance * step, y: position.y + (next.y - position.y) / distance * step };
    assert.ok(hasLineOfSight(position, moved, walls, 18), 'body must not clip cover');
    position = moved;
  }
  assert.ok(Math.hypot(position.x - target.x, position.y - target.y) <= 2);
});

test('long-range aim leads lateral movement and stays finite at contact', () => {
  assert.ok(leadAngle({ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 195 }) > 0);
  assert.equal(leadAngle({ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 0 }), 0);
  assert.ok(Number.isFinite(leadAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 })));
  assert.ok(sentinel.range > 190 * 4, 'shots should reach beyond the old 760px range');
});
