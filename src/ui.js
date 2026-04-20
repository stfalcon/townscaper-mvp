import { COLORS } from './constants.js';

const SURPRISE_UNLOCK_THRESHOLD = 10;
const SURPRISE_COLOR_ID = 6;

/**
 * DOM palette: renders 5+1 color buttons, handles selection, keyboard
 * shortcuts 1-6, and unlocks the 6th "Surprise" color after N placements.
 *
 * Not aware of Three.js — only mutates `input.currentColorId`.
 */
export class UI {
  constructor({ state, input, paletteEl }) {
    this.state = state;
    this.input = input;
    this.paletteEl = paletteEl ?? document.getElementById('palette');
    if (!this.paletteEl) throw new Error('Palette element #palette not found');

    this._buttons = new Map(); // colorId → button element
    this._placementsCount = 0;
    this._surpriseUnlocked = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPaletteClick = this._onPaletteClick.bind(this);
    this._onCellChanged = this._onCellChanged.bind(this);

    this.#renderPalette();
    this.paletteEl.addEventListener('click', this._onPaletteClick);
    window.addEventListener('keydown', this._onKeyDown);
    state.on('cellChanged', this._onCellChanged, 5);
  }

  #renderPalette() {
    this.paletteEl.innerHTML = '';
    for (const color of COLORS) {
      const btn = document.createElement('button');
      btn.className = 'color-btn';
      btn.type = 'button';
      btn.dataset.colorId = String(color.id);
      btn.style.setProperty('--color', '#' + color.hex.toString(16).padStart(6, '0'));
      btn.title = color.name;
      btn.setAttribute('aria-label', color.name);
      if (color.id === this.input.currentColorId) btn.dataset.selected = 'true';
      if (color.unlockAfter && !this._surpriseUnlocked) {
        btn.dataset.locked = 'true';
        btn.setAttribute('aria-hidden', 'true');
      }
      this.paletteEl.appendChild(btn);
      this._buttons.set(color.id, btn);
    }
  }

  /**
   * Public — called by click, keyboard, or programmatically. Respects the
   * lock on the surprise color (AC-F12 invariant: can't select it pre-unlock).
   */
  selectColor(colorId) {
    const btn = this._buttons.get(colorId);
    if (!btn) return; // unknown id
    if (btn.dataset.locked === 'true') return; // surprise still locked
    this.input.currentColorId = colorId;

    for (const [, b] of this._buttons) delete b.dataset.selected;
    btn.dataset.selected = 'true';

    btn.classList.remove('pulsing');
    // Trigger reflow so re-adding the class restarts the animation
    void btn.offsetWidth;
    btn.classList.add('pulsing');
  }

  _onPaletteClick(e) {
    const btn = e.target.closest('.color-btn');
    if (!btn) return;
    const id = Number(btn.dataset.colorId);
    if (Number.isFinite(id)) this.selectColor(id);
  }

  _onKeyDown(e) {
    // Ignore shortcuts when focus is in UI controls or a form field
    const t = e.target;
    if (t && t.closest?.('input, textarea, select')) return;
    const k = e.key;
    if (k >= '1' && k <= '6') {
      const id = Number(k);
      if (this._buttons.has(id)) {
        this.selectColor(id);
        e.preventDefault();
      }
    }
  }

  _onCellChanged({ op }) {
    if (op !== 'add') return;
    this._placementsCount++;
    if (
      !this._surpriseUnlocked &&
      this._placementsCount >= SURPRISE_UNLOCK_THRESHOLD
    ) {
      this.#unlockSurprise();
    }
  }

  #unlockSurprise() {
    this._surpriseUnlocked = true;
    const btn = this._buttons.get(SURPRISE_COLOR_ID);
    if (!btn) return;
    delete btn.dataset.locked;
    btn.removeAttribute('aria-hidden');
    btn.classList.add('unlocking');
    setTimeout(() => btn.classList.remove('unlocking'), 420);
  }

  /** Used by tests / debugging. */
  get placementsCount() { return this._placementsCount; }
  get surpriseUnlocked() { return this._surpriseUnlocked; }

  /** Snapshot of persistable UI state (for SaveState). */
  getSnapshot() {
    return {
      selectedColorId: this.input.currentColorId,
      placementsCount: this._placementsCount,
      surpriseUnlocked: this._surpriseUnlocked,
    };
  }

  /**
   * Restore UI state from a saved snapshot. Doesn't play unlock animation
   * (it's a restore, not a reward — just sets the button visible silently).
   */
  restoreSnapshot(snap) {
    if (!snap) return;
    this._placementsCount = snap.placementsCount ?? 0;
    if (snap.surpriseUnlocked && !this._surpriseUnlocked) {
      this._surpriseUnlocked = true;
      const btn = this._buttons.get(SURPRISE_COLOR_ID);
      if (btn) {
        delete btn.dataset.locked;
        btn.removeAttribute('aria-hidden');
      }
    }
    if (typeof snap.selectedColorId === 'number') {
      this.selectColor(snap.selectedColorId);
    }
  }

  dispose() {
    this.paletteEl.removeEventListener('click', this._onPaletteClick);
    window.removeEventListener('keydown', this._onKeyDown);
    this.state.off('cellChanged', this._onCellChanged);
  }
}
