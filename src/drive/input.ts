import { neutral, type Controls } from './config';
interface PointerControl { code?: string; button: HTMLElement; pad?: HTMLElement; steer?: number; order: number }
export class DriveInput {
  private keys = new Set<string>();
  private keyboard = new Set<string>();
  private pressed = new Map<string, number>();
  private pointers = new Map<number, PointerControl>();
  private sequence = 0;
  private press(code: string): void { if (!this.keys.has(code)) this.pressed.set(code, ++this.sequence); this.keys.add(code); }
  private release(code: string): void {
    if (this.keyboard.has(code) || [...this.pointers.values()].some(pointer => pointer.code === code)) return;
    this.keys.delete(code); this.pressed.delete(code);
  }
  private steer(pointer: PointerControl, x: number): void {
    const rect = pointer.pad!.getBoundingClientRect();
    const value = Math.max(-1, Math.min(1, (x - rect.left - rect.width / 2) / Math.max(1, rect.width / 4)));
    pointer.steer = Math.abs(value) < .12 ? 0 : Math.sign(value) * (Math.abs(value) - .12) / .88;
    pointer.order = ++this.sequence;
    pointer.pad!.querySelector('[data-key="KeyA"]')?.classList.toggle('is-held', pointer.steer < -.1);
    pointer.pad!.querySelector('[data-key="KeyD"]')?.classList.toggle('is-held', pointer.steer > .1);
  }
  private releasePointer(id: number): void {
    const pointer = this.pointers.get(id); if (!pointer) return;
    this.pointers.delete(id);
    if (pointer.code) this.release(pointer.code);
    if (pointer.pad) {
      const remaining = [...this.pointers.values()].filter(p => p.pad === pointer.pad).sort((a,b) => b.order-a.order)[0];
      pointer.pad.querySelector('[data-key="KeyA"]')?.classList.toggle('is-held', (remaining?.steer ?? 0) < -.1);
      pointer.pad.querySelector('[data-key="KeyD"]')?.classList.toggle('is-held', (remaining?.steer ?? 0) > .1);
    } else if (![...this.pointers.values()].some(p => p.button === pointer.button)) pointer.button.classList.remove('is-held');
  }
  constructor(command: (key: string) => void) {
    const reserved = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'KeyC', 'KeyV', 'KeyF', 'KeyM', 'Escape'];
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (reserved.includes(e.code)) e.preventDefault();
      if (!e.repeat && !(e.code === 'Enter' && e.target instanceof HTMLButtonElement)) command(e.code);
      this.keyboard.add(e.code); this.press(e.code);
    });
    window.addEventListener('keyup', e => { this.keyboard.delete(e.code); this.release(e.code); });
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerdown', e => {
      const target = e.target as HTMLElement, button = target.closest<HTMLElement>('[data-key]');
      const pad = target.closest<HTMLElement>('[data-steering-pad]');
      if (!button && !pad) return;
      e.preventDefault();
      const control: PointerControl = { button: button ?? pad!, order: ++this.sequence };
      if (pad) { control.pad = pad; this.steer(control, e.clientX); }
      else { control.code = button!.dataset.key!; this.press(control.code); button!.classList.add('is-held'); }
      this.pointers.set(e.pointerId, control);
      try { control.button.setPointerCapture(e.pointerId); } catch { /* Document listeners also handle synthetic/cancelled pointers. */ }
    });
    document.addEventListener('pointermove', e => {
      const pointer = this.pointers.get(e.pointerId); if (!pointer?.pad) return;
      e.preventDefault(); this.steer(pointer, e.clientX);
    }, { passive: false });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(event, e => this.releasePointer((e as PointerEvent).pointerId));
    document.addEventListener('contextmenu', e => { if ((e.target as HTMLElement).closest('.touch-controls')) e.preventDefault(); });
  }
  sample(): Controls {
    const k = this.keys, input = neutral();
    input.throttle = +(k.has('KeyW') || k.has('ArrowUp')); input.brake = +(k.has('KeyS') || k.has('ArrowDown'));
    const left = Math.max(this.pressed.get('KeyA') ?? 0, this.pressed.get('ArrowLeft') ?? 0);
    const right = Math.max(this.pressed.get('KeyD') ?? 0, this.pressed.get('ArrowRight') ?? 0);
    input.steer = left > right ? -1 : right > left ? 1 : 0;
    let newest = Math.max(left, right);
    for (const pointer of this.pointers.values()) if (pointer.pad && pointer.order > newest) { input.steer = pointer.steer ?? 0; newest = pointer.order; }
    input.nitro=k.has('ShiftLeft')||k.has('ShiftRight');
    input.handbrake = k.has('Space'); input.rear = k.has('KeyV'); return input;
  }
  clear(): void {
    for (const pointer of this.pointers.values()) {
      pointer.button.classList.remove('is-held'); pointer.pad?.querySelectorAll('.is-held').forEach(button => button.classList.remove('is-held'));
    }
    this.pointers.clear(); this.keyboard.clear(); this.keys.clear(); this.pressed.clear(); this.sequence = 0;
  }
}
