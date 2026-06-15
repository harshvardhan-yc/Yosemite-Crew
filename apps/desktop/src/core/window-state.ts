'use strict';

import fs from 'node:fs';
import path from 'node:path';

export interface WindowBounds {
  width: number;
  height: number;
}

export interface WindowState extends WindowBounds {
  x?: number;
  y?: number;
  isMaximized: boolean;
  zoomLevel?: number;
}

export interface WindowStateStore {
  load: (defaults?: WindowBounds) => WindowState;
  save: (state: Partial<WindowState>) => boolean;
}

interface StoreDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  logger?: { warn: (event: string, data?: unknown) => void };
}

interface ManagedWindow {
  on: (event: 'resize' | 'move' | 'close', listener: () => void) => unknown;
  isDestroyed: () => boolean;
  isMaximized: () => boolean;
  getNormalBounds?: () => WindowBounds & { x?: number; y?: number };
  getBounds: () => WindowBounds & { x?: number; y?: number };
  webContents?: { getZoomLevel?: () => number };
}

export const DEFAULT_BOUNDS: WindowBounds = Object.freeze({ width: 1440, height: 960 });
export const MIN_WIDTH = 1024;
export const MIN_HEIGHT = 700;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Validate and clamp a persisted window state, falling back to defaults for any
 * missing or malformed field. Pure function so it can be unit tested without Electron.
 */
export const normalizeWindowState = (
  saved: Partial<WindowState> | null | undefined,
  defaults: WindowBounds = DEFAULT_BOUNDS
): WindowState => {
  const source = (saved && typeof saved === 'object' ? saved : {}) as Partial<WindowState>;
  const width = isFiniteNumber(source.width)
    ? Math.max(MIN_WIDTH, Math.round(source.width))
    : defaults.width;
  const height = isFiniteNumber(source.height)
    ? Math.max(MIN_HEIGHT, Math.round(source.height))
    : defaults.height;

  const state: WindowState = { width, height, isMaximized: source.isMaximized === true };

  if (isFiniteNumber(source.x) && isFiniteNumber(source.y)) {
    state.x = Math.round(source.x);
    state.y = Math.round(source.y);
  }

  if (isFiniteNumber(source.zoomLevel)) {
    // Clamp to Chromium's practical zoom range.
    state.zoomLevel = Math.max(-5, Math.min(5, source.zoomLevel));
  }

  return state;
};

/**
 * Persistence store keyed to a JSON file. `deps` is injectable for tests.
 */
export const createWindowStateStore = (
  filePath: string,
  deps: StoreDeps = {}
): WindowStateStore => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;

  const load = (defaults: WindowBounds = DEFAULT_BOUNDS): WindowState => {
    try {
      const raw = readFileSync(filePath, 'utf8') as string;
      return normalizeWindowState(JSON.parse(raw), defaults);
    } catch (error) {
      deps.logger?.warn('window_state_load_failed', { error });
      return normalizeWindowState(null, defaults);
    }
  };

  const save = (state: Partial<WindowState>): boolean => {
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(normalizeWindowState(state)), 'utf8');
      return true;
    } catch (error) {
      deps.logger?.warn('window_state_save_failed', { error });
      return false;
    }
  };

  return { load, save };
};

/**
 * Wire a BrowserWindow to a store: save bounds (debounced) on resize/move and on close.
 */
export const manageWindow = (
  browserWindow: ManagedWindow,
  store: Pick<WindowStateStore, 'save'>,
  debounceMs = 400
): void => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const snapshot = (): Partial<WindowState> => {
    const isMaximized = browserWindow.isMaximized();
    const bounds = browserWindow.getNormalBounds
      ? browserWindow.getNormalBounds()
      : browserWindow.getBounds();
    const state: Partial<WindowState> = { ...bounds, isMaximized };
    try {
      const webContents = browserWindow.webContents;
      if (webContents && typeof webContents.getZoomLevel === 'function') {
        state.zoomLevel = webContents.getZoomLevel();
      }
    } catch {
      // ignore; zoom is best-effort
    }
    return state;
  };

  const persist = (): void => {
    if (browserWindow.isDestroyed()) return;
    store.save(snapshot());
  };

  const schedulePersist = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, debounceMs);
  };

  browserWindow.on('resize', schedulePersist);
  browserWindow.on('move', schedulePersist);
  browserWindow.on('close', () => {
    if (timer) clearTimeout(timer);
    persist();
  });
};
