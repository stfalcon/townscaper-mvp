import { STORAGE_KEY, SAVE_DEBOUNCE_MS } from './constants.js';

/**
 * Persists the game to localStorage. Listens for state changes, debounces,
 * and serializes the minimal payload (cells + UI snapshot, tileType is
 * derived so omitted per TDD §3.7).
 *
 * Defensive about the three realistic failure modes:
 *  - localStorage throws on access (Safari strict private mode)
 *  - setItem throws QuotaExceededError (full storage)
 *  - payload is corrupt or old (JSON.parse fails)
 */
export class SaveState {
  constructor({
    state, resolver, ui,
    key = STORAGE_KEY,
    debounceMs = SAVE_DEBOUNCE_MS,
    storage, // explicit override for tests; defaults to detected localStorage
    now = () => Date.now(),
  }) {
    this.state = state;
    this.resolver = resolver;
    this.ui = ui;
    this.key = key;
    this.debounceMs = debounceMs;
    this._now = now;

    this.storage = storage === undefined ? detectStorage() : storage;
    this.disabled = this.storage === null;

    this.paused = false;
    this._timer = null;
    this._bannerShown = false;

    this._onCellChanged = this._onCellChanged.bind(this);
  }

  attach() {
    // priority 6 — runs after TileResolver (1), Renderer (2, 3), UI (5)
    this.state.on('cellChanged', this._onCellChanged, 6);
    if (this.disabled) this._showBanner('💾 Збереження вимкнено (приватний режим)');
  }

  detach() {
    this.state.off('cellChanged', this._onCellChanged);
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  _onCellChanged({ op }) {
    if (op === 'add' || op === 'remove' || op === 'clear') this._scheduleSave();
  }

  _scheduleSave() {
    if (this.paused || this.disabled) return;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this.save();
    }, this.debounceMs);
  }

  /** Force an immediate save (cancels any pending debounced call). */
  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    return this.save();
  }

  save() {
    if (this.disabled) return false;
    const payload = {
      ...this.state.toJSON(),
      timestamp: this._now(),
      ui: this.ui?.getSnapshot?.() ?? null,
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
      return true;
    } catch (err) {
      if (isQuotaError(err)) {
        this._showToast('💾 Не вдалось зберегти — місце вичерпано');
      } else {
        console.error('[saveState] save failed:', err);
      }
      return false;
    }
  }

  /**
   * Load from storage. Returns true if state was populated, false if there
   * was nothing to load OR the save was corrupt (in which case it's cleared).
   */
  load() {
    if (this.disabled) return false;
    let raw;
    try {
      raw = this.storage.getItem(this.key);
    } catch (err) {
      console.warn('[saveState] storage read failed:', err);
      return false;
    }
    if (!raw) return false;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.warn('[saveState] corrupt save, clearing:', err);
      this.clear();
      return false;
    }
    if (!data || typeof data !== 'object') return false;

    this.state.fromJSON(data);
    this.resolver?.resolveAll();
    if (data.ui) this.ui?.restoreSnapshot?.(data.ui);
    return true;
  }

  clear() {
    if (this.disabled) return;
    try {
      this.storage.removeItem(this.key);
    } catch (err) {
      console.warn('[saveState] storage clear failed:', err);
    }
  }

  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    this._scheduleSave();
  }

  _showToast(message) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  _showBanner(message) {
    if (this._bannerShown || typeof document === 'undefined') return;
    this._bannerShown = true;
    const el = document.createElement('div');
    el.className = 'banner';
    el.textContent = message;
    document.body.appendChild(el);
  }
}

function detectStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const testKey = '__townscaper_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return localStorage;
  } catch {
    return null;
  }
}

function isQuotaError(err) {
  return (
    err &&
    (err.name === 'QuotaExceededError' ||
     err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
     err.code === 22 || err.code === 1014)
  );
}
