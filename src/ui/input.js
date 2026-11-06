/** Keyboard + on-screen touch buttons, merged into one steer value. */
export class Input {
  constructor({ left, right }) {
    this.keys = new Set();
    this.touch = { left: false, right: false };
    this.handlers = {};

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return; // let checkboxes work normally
      // Enter/Space are handled by the game, not by whichever button has focus
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.handlers.key?.(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.touch.left = this.touch.right = false;
    });

    const bind = (el, side) => {
      const on = (e) => {
        e.preventDefault();
        this.touch[side] = true;
        el.classList.add('pressed');
      };
      const off = () => {
        this.touch[side] = false;
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bind(left, 'left');
    bind(right, 'right');
  }

  onKey(fn) {
    this.handlers.key = fn;
  }

  /** -1 = left, +1 = right */
  get steer() {
    const k = this.keys;
    const l = k.has('KeyA') || k.has('ArrowLeft') || this.touch.left;
    const r = k.has('KeyD') || k.has('ArrowRight') || this.touch.right;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }
}
