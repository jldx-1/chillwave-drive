import type { Vehicle } from './vehicle';

export type PowerUpKind = 'shield' | 'turbo';
export interface PowerUp { id: number; x: number; s: number; kind: PowerUpKind }
export const POWERUP_DURATION = { shield: 8, turbo: 6 } as const;
export const POWERUP_SPACING = 480;
const FIRST_PICKUP = 90;

/** Logical positions keep pickup collection stable across rendering and origin rebases. */
export class PowerUps {
  private collected = new Set<number>();
  private furthest = 0;
  reset(): void { this.collected.clear(); this.furthest = 0; }
  nearby(s: number): PowerUp[] {
    const items: PowerUp[] = [];
    for (let id = Math.max(0, Math.floor((s - FIRST_PICKUP) / POWERUP_SPACING) - 1); id <= Math.floor((s + 850 - FIRST_PICKUP) / POWERUP_SPACING); id++) {
      const at = FIRST_PICKUP + id * POWERUP_SPACING;
      if (at < this.furthest - 400 || this.collected.has(id)) continue;
      items.push({ id, s: at, x: [6.5, 10.1, 2.9, 13.7][id % 4], kind: id % 2 ? 'turbo' : 'shield' });
    }
    return items;
  }
  collect(player: Vehicle): PowerUpKind[] {
    const rewards: PowerUpKind[] = [];
    for (const item of this.nearby(player.s)) {
      // Segment-to-point distance also catches a pickup between fixed-step positions.
      const dx = player.x - player.previous.x, ds = player.s - player.previous.s;
      const t = Math.max(0, Math.min(1, ((item.x - player.previous.x) * dx + (item.s - player.previous.s) * ds) / (dx * dx + ds * ds || 1)));
      if (player.jumpHeight > 2 || Math.hypot(item.x - player.previous.x - dx * t, item.s - player.previous.s - ds * t) > 1.65) continue;
      this.collected.add(item.id); player.activatePowerUp(item.kind); rewards.push(item.kind);
    }
    this.furthest = Math.max(this.furthest, player.s);
    for (const id of this.collected) if (FIRST_PICKUP + id * POWERUP_SPACING < this.furthest - 400) this.collected.delete(id);
    return rewards;
  }
}
