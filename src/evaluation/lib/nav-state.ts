/**
 * Utilities for global navigation state persistence
 */

const STORAGE_KEYS = {
  COLLAPSED: 'globalNav_collapsed',
  WIDTH: 'globalNav_width',
} as const;

const DEFAULTS = {
  COLLAPSED: false,
  WIDTH: 256, // pixels
  MIN_WIDTH: 200,
  MAX_WIDTH: 400,
  COLLAPSED_WIDTH: 64,
} as const;

/**
 * Get collapsed state from localStorage
 */
export function getNavCollapsed(): boolean {
  if (typeof window === 'undefined') return DEFAULTS.COLLAPSED;
  
  const stored = localStorage.getItem(STORAGE_KEYS.COLLAPSED);
  if (stored === null) return DEFAULTS.COLLAPSED;
  
  return stored === 'true';
}

/**
 * Set collapsed state in localStorage
 */
export function setNavCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.COLLAPSED, String(collapsed));
}

/**
 * Get width from localStorage
 */
export function getNavWidth(): number {
  if (typeof window === 'undefined') return DEFAULTS.WIDTH;
  
  const stored = localStorage.getItem(STORAGE_KEYS.WIDTH);
  if (stored === null) return DEFAULTS.WIDTH;
  
  const width = parseInt(stored, 10);
  if (isNaN(width)) return DEFAULTS.WIDTH;
  
  // Clamp to valid range
  return Math.max(DEFAULTS.MIN_WIDTH, Math.min(DEFAULTS.MAX_WIDTH, width));
}

/**
 * Set width in localStorage (debounced)
 */
let widthDebounceTimer: NodeJS.Timeout | null = null;

export function setNavWidth(width: number): void {
  if (typeof window === 'undefined') return;
  
  // Clamp to valid range
  const clampedWidth = Math.max(DEFAULTS.MIN_WIDTH, Math.min(DEFAULTS.MAX_WIDTH, width));
  
  // Debounce writes to localStorage
  if (widthDebounceTimer) {
    clearTimeout(widthDebounceTimer);
  }
  
  widthDebounceTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEYS.WIDTH, String(clampedWidth));
    widthDebounceTimer = null;
  }, 100);
}

/**
 * Get effective width (collapsed width if collapsed, otherwise stored width)
 */
export function getEffectiveNavWidth(collapsed: boolean): number {
  return collapsed ? DEFAULTS.COLLAPSED_WIDTH : getNavWidth();
}

export { DEFAULTS };
