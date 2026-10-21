import { neutral, type Controls } from './config';
export class DriveInput {
  private keys = new Set<string>();
  private pressed = new Map<string,number>();
  private sequence = 0;
  private press(code:string):void { if(!this.keys.has(code))this.pressed.set(code,++this.sequence);this.keys.add(code); }
  private release(code:string):void { this.keys.delete(code);this.pressed.delete(code); }
  constructor(command: (key: string) => void) {
    const reserved = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyC', 'KeyV', 'KeyF', 'KeyM', 'Escape'];
    window.addEventListener('keydown', e => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (reserved.includes(e.code)) e.preventDefault();
      if (!e.repeat && !(e.code === 'Enter' && e.target instanceof HTMLButtonElement)) command(e.code);
      this.press(e.code);
    });
    window.addEventListener('keyup', e => this.release(e.code));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('pointerdown', e => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!button) return;
      e.preventDefault(); const code = button.dataset.key!; this.press(code); button.setPointerCapture(e.pointerId);
      const release = () => { this.release(code); };
      button.addEventListener('pointerup', release, { once: true }); button.addEventListener('pointercancel', release, { once: true });
      button.addEventListener('lostpointercapture', release, { once: true });
    });
  }
  sample(): Controls {
    const k = this.keys, i = neutral();
    i.throttle = +(k.has('KeyW') || k.has('ArrowUp')); i.brake = +(k.has('KeyS') || k.has('ArrowDown'));
    const left=Math.max(this.pressed.get('KeyA')??0,this.pressed.get('ArrowLeft')??0);
    const right=Math.max(this.pressed.get('KeyD')??0,this.pressed.get('ArrowRight')??0);
    i.steer=left>right?-1:right>left?1:0;
    i.handbrake = k.has('Space'); i.rear = k.has('KeyV'); return i;
  }
  clear(): void { this.keys.clear(); this.pressed.clear(); this.sequence=0; }
}
