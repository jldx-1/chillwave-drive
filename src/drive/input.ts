import { neutral, type Controls } from './config';
export class DriveInput {
  private keys = new Set<string>();
  constructor(command: (key: string) => void) {
    const reserved = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyV', 'KeyF', 'KeyM', 'Escape'];
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (reserved.includes(e.code)) e.preventDefault();
      if (!e.repeat && !(e.code === 'Enter' && e.target instanceof HTMLButtonElement)) command(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerdown', e => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!button) return;
      e.preventDefault(); const code = button.dataset.key!; this.keys.add(code); button.setPointerCapture(e.pointerId);
      const release = () => { this.keys.delete(code); };
      button.addEventListener('pointerup', release, { once: true }); button.addEventListener('pointercancel', release, { once: true });
      button.addEventListener('lostpointercapture', release, { once: true });
    });
  }
  sample(): Controls {
    const k = this.keys, i = neutral();
    i.throttle = +(k.has('KeyW') || k.has('ArrowUp')); i.brake = +(k.has('KeyS') || k.has('ArrowDown'));
    i.steer = +(k.has('KeyD') || k.has('ArrowRight')) - +(k.has('KeyA') || k.has('ArrowLeft'));
    i.handbrake = k.has('Space'); i.rear = k.has('KeyV'); return i;
  }
  clear(): void { this.keys.clear(); }
}
