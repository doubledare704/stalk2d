import type { BossId } from './model';

export const bosses = {
  warden: { name: 'ВАРТОВИЙ', hp: 800, speed: 38, color: 0x8e7964, cooldown: 2200, size: 29 },
  ravager: { name: 'РУЙНІВНИК', hp: 650, speed: 55, color: 0xa87156, cooldown: 3000, size: 26 },
  oracle: { name: 'ПРОРОК', hp: 620, speed: 30, color: 0x7c8ba8, cooldown: 1850, size: 25 },
} as const;

export function bossVolley(kind: BossId, angle: number, phase: number): { angle: number; speed: number }[] {
  if (kind === 'ravager') return [];
  if (kind === 'oracle') return Array.from({ length: 5 }, (_, i) => ({ angle: angle + (i - 2) * .15, speed: 240 }));
  return Array.from({ length: 10 }, (_, i) => ({ angle: angle + phase * .15 + i * Math.PI * 2 / 10, speed: 165 }));
}
