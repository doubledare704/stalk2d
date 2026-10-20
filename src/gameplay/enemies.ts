export interface Point { x: number; y: number }
export interface Obstacle extends Point { w: number; h: number }

export const sentinel = {
  name: 'НАГЛЯДАЧ', baseHp: 220, hpPerSector: 12, speed: 42,
  range: 1050, preferredRange: 560, shotSpeed: 350, damage: 12,
  cycleMs: 2400, aimMs: 650, lockMs: 180, burstShots: 3, burstIntervalMs: 170,
} as const;

// Slab intersection: include edges so neither sight nor navigation cuts corners.
export function hasLineOfSight(from: Point, to: Point, walls: readonly Obstacle[], clearance = 0): boolean {
  return !walls.some(wall => {
    let near = 0, far = 1;
    for (const [origin, delta, min, max] of [
      [from.x, to.x - from.x, wall.x - clearance, wall.x + wall.w + clearance],
      [from.y, to.y - from.y, wall.y - clearance, wall.y + wall.h + clearance],
    ]) {
      if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return false; }
      else {
        const a = (min - origin) / delta, b = (max - origin) / delta;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        if (near > far) return false;
      }
    }
    return true;
  });
}

export function leadAngle(from: Point, target: Point, velocity: Point): number {
  const lead = Math.min(.5, Math.hypot(target.x - from.x, target.y - from.y) / sentinel.shotSpeed);
  return Math.atan2(target.y + velocity.y * lead - from.y, target.x + velocity.x * lead - from.x);
}

// A tiny visibility graph is sufficient for this game's small, rectangular rooms.
export function pursuitWaypoint(from: Point, target: Point, walls: readonly Obstacle[], radius = 18): Point {
  const padding = radius + 3;
  const corners = walls.flatMap(w => [
    { x: w.x - padding, y: w.y - padding }, { x: w.x + w.w + padding, y: w.y - padding },
    { x: w.x - padding, y: w.y + w.h + padding }, { x: w.x + w.w + padding, y: w.y + w.h + padding },
  ]).filter(p => p.x > 99 + radius && p.x < 1181 - radius && p.y > 200 + radius && p.y < 695 - radius);
  const nodes = [from, target, ...corners];
  const distances = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
  distances[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
    if (current < 0 || !Number.isFinite(distances[current])) break;
    if (current === 1) {
      let next = 1;
      while (previous[next] > 0) next = previous[next];
      return nodes[next];
    }
    visited.add(current);
    for (let i = 1; i < nodes.length; i++) {
      if (visited.has(i) || !hasLineOfSight(nodes[current], nodes[i], walls, radius)) continue;
      const cost = distances[current] + Math.hypot(nodes[i].x - nodes[current].x, nodes[i].y - nodes[current].y);
      if (cost < distances[i]) { distances[i] = cost; previous[i] = current; }
    }
  }
  return from;
}
