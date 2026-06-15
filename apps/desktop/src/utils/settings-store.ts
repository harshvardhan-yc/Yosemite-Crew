'use strict';

import fs from 'node:fs';
import path from 'node:path';

export const SETTINGS_FILENAME = 'settings.json';

export type UpdateChannel = 'latest' | 'beta';
export type ThemeMode = 'system' | 'light' | 'dark';
export type TelehealthProviderSetting = 'getstream';

export interface DesktopSettings {
  updateChannel: UpdateChannel;
  idleLockMinutes: number;
  telemetryOptIn: boolean;
  theme: ThemeMode;
  openAtLogin: boolean;
  notificationsEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  biometricLockEnabled: boolean;
  accentColor: string;
  fontScale: number;
  telehealthProvider: TelehealthProviderSetting;
  lastSeenVersion: string;
}

export const DEFAULT_SETTINGS: DesktopSettings = {
  updateChannel: 'latest',
  idleLockMinutes: 0,
  telemetryOptIn: false,
  theme: 'system',
  openAtLogin: false,
  notificationsEnabled: true,
  dndStart: '22:00',
  dndEnd: '07:00',
  biometricLockEnabled: false,
  accentColor: '#3b87ec',
  fontScale: 1,
  telehealthProvider: 'getstream',
  lastSeenVersion: '',
};

const SETTINGS_KEYS: (keyof DesktopSettings)[] = [
  'updateChannel',
  'idleLockMinutes',
  'telemetryOptIn',
  'theme',
  'openAtLogin',
  'notificationsEnabled',
  'dndStart',
  'dndEnd',
  'biometricLockEnabled',
  'accentColor',
  'fontScale',
  'telehealthProvider',
  'lastSeenVersion',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isUpdateChannel = (value: unknown): value is UpdateChannel =>
  value === 'latest' || value === 'beta';

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

export const isTelehealthProviderSetting = (value: unknown): value is TelehealthProviderSetting =>
  value === 'getstream';

export const normalizeSettings = (raw: unknown): DesktopSettings => {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };

  const settings: DesktopSettings = { ...DEFAULT_SETTINGS };

  for (const key of SETTINGS_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];

    switch (key) {
      case 'updateChannel':
        if (isUpdateChannel(value)) settings.updateChannel = value;
        break;
      case 'idleLockMinutes':
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
          settings.idleLockMinutes = Math.min(1440, Math.round(value));
        }
        break;
      case 'telemetryOptIn':
        if (typeof value === 'boolean') settings.telemetryOptIn = value;
        break;
      case 'theme':
        if (isThemeMode(value)) settings.theme = value;
        break;
      case 'openAtLogin':
        if (typeof value === 'boolean') settings.openAtLogin = value;
        break;
      case 'notificationsEnabled':
        if (typeof value === 'boolean') settings.notificationsEnabled = value;
        break;
      case 'dndStart':
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) settings.dndStart = value;
        break;
      case 'dndEnd':
        if (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)) settings.dndEnd = value;
        break;
      case 'biometricLockEnabled':
        if (typeof value === 'boolean') settings.biometricLockEnabled = value;
        break;
      case 'accentColor':
        if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))
          settings.accentColor = value;
        break;
      case 'fontScale':
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 2) {
          settings.fontScale = Math.round(value * 4) / 4;
        }
        break;
      case 'telehealthProvider':
        if (isTelehealthProviderSetting(value)) settings.telehealthProvider = value;
        break;
      case 'lastSeenVersion':
        if (typeof value === 'string') settings.lastSeenVersion = value;
        break;
    }
  }

  return settings;
};

export interface SettingsStore {
  load: () => DesktopSettings;
  save: (partial: Partial<DesktopSettings>) => DesktopSettings;
  filePath: string;
}

interface StoreDeps {
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
}

export const createSettingsStore = (filePath: string, deps: StoreDeps = {}): SettingsStore => {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  const writeFileSync = deps.writeFileSync || fs.writeFileSync;
  const mkdirSync = deps.mkdirSync || fs.mkdirSync;

  let cached: DesktopSettings | null = null;

  const load = (): DesktopSettings => {
    try {
      const raw = readFileSync(filePath, 'utf8') as string;
      cached = normalizeSettings(JSON.parse(raw));
    } catch {
      cached = { ...DEFAULT_SETTINGS };
    }
    return { ...cached };
  };

  const save = (partial: Partial<DesktopSettings>): DesktopSettings => {
    if (!cached) cached = load();
    const merged = { ...cached, ...partial } as Partial<DesktopSettings>;
    cached = normalizeSettings(merged as DesktopSettings);
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(cached, null, 2), 'utf8');
    } catch {
      // persist must never break the app
    }
    return { ...cached };
  };

  return { load, save, filePath };
};
