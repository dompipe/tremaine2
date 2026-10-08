export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.down.delete(k);
    });
  }
  pressKey(key) {
    const k = key.toLowerCase();
    if (!this.down.has(k)) this.pressed.add(k);
    this.down.add(k);
  }
  releaseKey(key) {
    this.down.delete(key.toLowerCase());
  }
  bindVirtualButton(button, key) {
    if (!button) return;
    const press = (event) => {
      event.preventDefault();
      this.pressKey(key);
      button.classList.add("active");
    };
    const release = (event) => {
      event.preventDefault();
      this.releaseKey(key);
      button.classList.remove("active");
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }
  bindVirtualDpad(root = document) {
    root.querySelectorAll("[data-dpad-key]").forEach((button) => {
      this.bindVirtualButton(button, button.dataset.dpadKey);
    });
  }
  isDown(key) { return this.down.has(key.toLowerCase()); }
  consumePressed(key) {
    const k = key.toLowerCase();
    const had = this.pressed.has(k);
    this.pressed.delete(k);
    return had;
  }
  clearPressed() { this.pressed.clear(); }
}
