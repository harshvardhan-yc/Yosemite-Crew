import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yc-ipc-'));

const childWindow = {
  setMenuBarVisibility: jest.fn(),
  loadURL: jest.fn(() => Promise.resolve()),
  setTitle: jest.fn(),
  on: jest.fn(),
  webContents: { on: jest.fn() },
};
const BrowserWindowMock = jest.fn(() => childWindow);

jest.mock('electron', () => ({
  app: { getPath: () => tmp, getVersion: () => '1.0.0' },
  BrowserWindow: BrowserWindowMock,
  dialog: {
    showSaveDialog: jest.fn(() =>
      Promise.resolve({ canceled: false, filePath: path.join(tmp, 'export.bin') })
    ),
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  },
  ipcMain: { handle: jest.fn() },
  net: { isOnline: () => true },
  shell: { showItemInFolder: jest.fn() },
}));

const openExternal = jest.fn(() => Promise.resolve());
jest.mock('../src/shell/window-config', () => ({
  openExternal: (...a: unknown[]) => openExternal(...a),
  secureWebPreferences: () => ({}),
}));
jest.mock('../src/ui/theming', () => ({
  applyThemeToWebContents: jest.fn(() => Promise.resolve()),
  DEFAULT_ACCENT_COLOR: '#3b87ec',
}));

import { registerIpc, type IpcServices } from '../src/core/ipc-handlers';
import { getDesktopConfig } from '../src/core/navigation-policy';
import { BUILTIN_ACTIONS } from '../src/ui/command-palette';

const event = { senderFrame: { url: 'https://yosemitecrew.com/dashboard' } };

const makeWc = () => ({
  findInPage: jest.fn(() => 7),
  stopFindInPage: jest.fn(),
  isDevToolsOpened: jest.fn(() => false),
  openDevTools: jest.fn(),
  closeDevTools: jest.fn(),
  getURL: jest.fn(() => 'https://yosemitecrew.com/page'),
  isDestroyed: jest.fn(() => false),
  capturePage: jest.fn(() => Promise.resolve({ toDataURL: () => 'data:image/png;base64,AA' })),
});

const makeServices = (overrides: Partial<IpcServices> = {}): IpcServices => {
  const wc = makeWc();
  const view = {};
  return {
    config: getDesktopConfig({}),
    logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
    localFileRoot: tmp,
    brandPrefix: 'Yosemite Crew',
    productName: 'Yosemite Crew PIMS',
    chromeStripHeight: 40,
    verticalTabWidth: 240,
    mainWindow: {
      isDestroyed: () => false,
      contentView: { addChildView: jest.fn(), removeChildView: jest.fn() },
      getContentBounds: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
    } as never,
    activeContents: () => wc as never,
    loadStartUrl: jest.fn(),
    enterTabMode: jest.fn(),
    tabMode: true,
    tabManager: {
      create: jest.fn(() => 't2'),
      close: jest.fn(),
      activate: jest.fn(() => true),
      getState: jest.fn(() => ({
        tabs: [
          { id: 't1', url: 'https://yosemitecrew.com/a', title: 'A', zoom: 1 },
          { id: 't2', url: 'https://yosemitecrew.com/b', title: 'B' },
        ],
        activeId: 't1',
      })),
      move: jest.fn(() => true),
      pin: jest.fn(() => true),
      duplicate: jest.fn(() => 't3'),
      reopenClosed: jest.fn(() => 't4'),
      updateMeta: jest.fn(),
      persist: jest.fn(() => '{}'),
      restore: jest.fn(),
    } as never,
    tabViewHost: {
      create: jest.fn(),
      destroy: jest.fn(),
      get: jest.fn((id: string) =>
        typeof id === 'string' && id.startsWith('t') ? view : undefined
      ),
      getWebContents: jest.fn(() => wc),
      setBounds: jest.fn(),
      setZoom: jest.fn(),
      toggleMute: jest.fn(() => true),
      destroyAll: jest.fn(),
    } as never,
    attachedTabId: 't1',
    tabOrientation: 'horizontal',
    splitId: null,
    tabChromeView: {
      webContents: { isDestroyed: () => false, executeJavaScript: () => Promise.resolve() },
    } as never,
    layoutTabChrome: jest.fn(),
    setTabSearch: jest.fn(),
    setSplitTab: jest.fn(),
    setTabOrientation: jest.fn(),
    saveSession: jest.fn(),
    commandPaletteWindow: { isDestroyed: () => false, close: jest.fn() } as never,
    settingsWindow: null,
    openVaultWindow: jest.fn(),
    navigateToDeepLink: jest.fn(),
    settingsStore: {
      load: () => ({ accentColor: '#fff', fontScale: 1 }),
      save: (p: object) => ({ ...p }),
    } as never,
    applySettings: jest.fn(),
    recentsStore: { load: () => [{ id: 'x' }] } as never,
    offlineCache: {
      getStats: () => ({ count: 1 }),
      clear: jest.fn(),
      entries: () => [
        { url: 'https://yosemitecrew.com/a', headers: { 'x-yc-title': 'A' }, cachedAt: 2 },
      ],
      get: (u: string) =>
        u === 'https://hit'
          ? { body: Buffer.from('x'), contentType: 'text/html', headers: {}, cachedAt: 1 }
          : undefined,
    } as never,
    notificationManager: { show: () => true } as never,
    biometricLock: { isAvailable: () => true, authenticate: () => Promise.resolve(true) } as never,
    documentVault: {
      saveDocument: () => ({ id: 'd' }),
      listDocuments: () => [],
      getDocumentBuffer: (id: string) =>
        id === 'd' ? { doc: { filename: 'f.txt' }, content: Buffer.from('x') } : null,
      deleteDocument: (id: string) => id === 'd',
      getStats: () => ({ count: 0, totalSizeBytes: 0 }),
      saveDocumentBuffer: () => ({ id: 'd' }),
    } as never,
    syncEngine: {} as never,
    offlineStore: {} as never,
    keyboardShortcutManager: {} as never,
    auditLog: { append: () => ({ id: 'a', action: 'act' }) } as never,
    controlledSubstanceLog: { record: () => ({ id: 't', drugName: 'd' }) } as never,
    csExport: { exportDailyLog: () => ({ rowCount: 1, filePath: '/x' }) } as never,
    deaTracker: {
      register: jest.fn(),
      getAllRegistrations: () => [],
      getExpiringSoon: () => [],
    } as never,
    lastOfflineSyncResults: [],
    lastOfflineSyncError: null,
    getSyncStatusSummary: () => ({ state: 'synced' }) as never,
    runOfflineFullSync: jest.fn(() => Promise.resolve([{ errors: [] }])) as never,
    clearLocalDesktopData: jest.fn(() => Promise.resolve({ cache: true })),
    unreadCount: 0,
    updateUnreadBadge: jest.fn(),
    startTelehealth: jest.fn(() => 'https://yosemitecrew.com/telehealth'),
    ...overrides,
  };
};

const register = (services: IpcServices) => {
  const handlers: Record<string, (e: unknown, ...a: unknown[]) => Promise<unknown>> = {};
  registerIpc(services, {
    handle: (ch: string, fn: never) => {
      handlers[ch] = fn;
    },
  } as never);
  return (channel: string, ...args: unknown[]) => handlers[channel](event, ...args);
};

describe('ipc-handlers — happy paths', () => {
  test('core + settings + palette + cache handlers', async () => {
    const services = makeServices();
    const call = register(services);
    expect(await call('yc:reload')).toEqual({ ok: true });
    expect(await call('yc:open-in-browser')).toEqual({ ok: true });
    expect(await call('yc:start-signin')).toEqual({ ok: true });
    expect(await call('yc:start-telehealth', { appointmentId: 'x' })).toMatchObject({ ok: true });
    expect(await call('yc:get-settings')).toMatchObject({ ok: true });
    expect(await call('yc:set-settings', { theme: 'dark' })).toMatchObject({ ok: true });
    expect(await call('yc:execute-command', BUILTIN_ACTIONS[0].id)).toBeDefined();
    expect(await call('yc:get-palette-recents')).toMatchObject({ ok: true });
    expect(await call('yc:get-palette-actions')).toMatchObject({ ok: true });
    expect(await call('yc:close-palette')).toEqual({ ok: true });
    expect(await call('yc:get-cache-status')).toMatchObject({ ok: true });
    expect(await call('yc:clear-cache')).toEqual({ ok: true });
    expect(await call('yc:get-cached-urls')).toMatchObject({ ok: true });
    expect(await call('yc:get-cached-content', 'https://hit')).toMatchObject({ ok: true });
  });

  test('sync, notifications, biometric, theme, compliance, vault', async () => {
    const services = makeServices();
    const call = register(services);
    expect(await call('yc:get-sync-status')).toMatchObject({ ok: true });
    expect(await call('yc:sync-now')).toMatchObject({ ok: true });
    expect(await call('yc:clear-local-data')).toMatchObject({ ok: true });
    expect(await call('yc:show-notification', { title: 'T', body: 'B' })).toMatchObject({
      ok: true,
      shown: true,
    });
    expect(await call('yc:clear-notification-badge')).toEqual({ ok: true });
    expect(await call('yc:authenticate-biometric', 'why')).toMatchObject({ ok: true });
    expect(await call('yc:apply-theme')).toEqual({ ok: true });
    expect(await call('yc:cs-record', { drug: 'x' })).toMatchObject({ ok: true });
    expect(await call('yc:cs-export', '2026-01-01')).toMatchObject({ ok: true });
    expect(await call('yc:audit-append', { action: 'a' })).toMatchObject({ ok: true });
    expect(await call('yc:vault-save', 'f.txt', 'data')).toMatchObject({ ok: true });
    expect(await call('yc:vault-list')).toMatchObject({ ok: true });
    expect(await call('yc:vault-get', 'd')).toMatchObject({ ok: true });
    expect(await call('yc:vault-stats')).toMatchObject({ ok: true });
    expect(
      await call('yc:vault-save-buffer', 'f.txt', Buffer.from('x').toString('base64'))
    ).toMatchObject({ ok: true });
    expect(await call('yc:vault-export', 'd')).toMatchObject({ ok: true });
    expect(await call('yc:vault-reveal-doc', 'd')).toMatchObject({ ok: true });
    expect(await call('yc:vault-open')).toEqual({ ok: true });
    expect(await call('yc:vault-delete', 'd')).toMatchObject({ ok: true });
    expect(await call('yc:dea-register', { deaNumber: 'AB1' })).toMatchObject({ ok: true });
  });

  test('tab + window + misc handlers', async () => {
    const services = makeServices();
    const call = register(services);
    expect(await call('yc:open-patient-window', 'p1', 'Rex')).toMatchObject({ ok: true });
    expect(await call('yc:tabs-get')).toMatchObject({ ok: true });
    expect(await call('yc:tab-new', 'https://yosemitecrew.com/x')).toMatchObject({ ok: true });
    expect(await call('yc:tab-activate', 't1')).toMatchObject({ ok: true });
    expect(await call('yc:tab-move', 't1', 1)).toMatchObject({ ok: true });
    expect(await call('yc:tab-pin', 't1', true)).toMatchObject({ ok: true });
    expect(await call('yc:tab-duplicate', 't1')).toMatchObject({ ok: true });
    expect(await call('yc:tab-reopen-closed')).toMatchObject({ ok: true });
    expect(await call('yc:tab-search', true)).toEqual({ ok: true });
    expect(await call('yc:tab-set-zoom', 't1', 1.2)).toMatchObject({ ok: true });
    expect(await call('yc:find-in-page', { text: 'x' })).toMatchObject({ ok: true });
    expect(await call('yc:stop-find-in-page')).toMatchObject({ ok: true });
    expect(await call('yc:open-devtools')).toMatchObject({ ok: true });
    expect(await call('yc:close-devtools')).toMatchObject({ ok: true });
    expect(await call('yc:tab-toggle-mute', 't1')).toMatchObject({ ok: true });
    expect(await call('yc:tab-get-preview', 't1')).toMatchObject({ ok: true });
    expect(await call('yc:tab-set-orientation', 'vertical')).toEqual({ ok: true });
    expect(await call('yc:show-cheatsheet')).toEqual({ ok: true });
    expect(await call('yc:get-app-version')).toBe('1.0.0');
    expect(await call('yc:get-last-seen-version')).toBe('');
    expect(await call('yc:set-last-seen-version', '1.0.0')).toMatchObject({ ok: true });
    expect(await call('yc:dismiss-whats-new')).toBeDefined();
    expect(await call('yc:tab-close', 't2')).toMatchObject({ ok: true });
  });
});

describe('ipc-handlers — not-ready / invalid branches', () => {
  test('returns errors when services are missing or args invalid', async () => {
    const services = makeServices({
      settingsStore: null,
      offlineCache: null,
      notificationManager: null,
      biometricLock: null,
      documentVault: null,
      controlledSubstanceLog: null,
      csExport: null,
      auditLog: null,
      deaTracker: null,
      tabManager: null,
    });
    const call = register(services);
    expect(await call('yc:get-settings')).toMatchObject({ ok: false });
    expect(await call('yc:set-settings', [])).toMatchObject({ ok: false });
    expect(await call('yc:get-cache-status')).toMatchObject({ ok: false });
    expect(await call('yc:show-notification', { title: 1 })).toMatchObject({ ok: false });
    expect(await call('yc:authenticate-biometric')).toMatchObject({ ok: false });
    expect(await call('yc:cs-record', null)).toMatchObject({ ok: false });
    expect(await call('yc:vault-get', 123)).toMatchObject({ ok: false });
    expect(await call('yc:dea-register', null)).toMatchObject({ ok: false });
    expect(await call('yc:tabs-get')).toMatchObject({ ok: false });
    expect(await call('yc:execute-command', 42)).toMatchObject({ ok: false });
  });

  test('sync-now reports not-ready and offline', async () => {
    expect(await register(makeServices({ syncEngine: null }))('yc:sync-now')).toMatchObject({
      ok: false,
      error: 'sync-not-ready',
    });
  });

  test('tab handlers reject invalid ids, missing tabs and disallowed urls', async () => {
    const call = register(makeServices());
    expect(await call('yc:tab-new', 'https://evil.example.com/')).toMatchObject({
      ok: false,
      error: 'url-not-allowed',
    });
    expect(await call('yc:tab-close', 123)).toMatchObject({ ok: false, error: 'invalid-id' });
    expect(await call('yc:tab-move', 't1', 'x')).toMatchObject({
      ok: false,
      error: 'invalid-args',
    });
    expect(await call('yc:tab-pin', 't1', 'x')).toMatchObject({ ok: false, error: 'invalid-args' });
    expect(await call('yc:tab-duplicate', 999)).toMatchObject({ ok: false, error: 'invalid-id' });
    expect(await call('yc:tab-set-zoom', 't1', 'x')).toMatchObject({
      ok: false,
      error: 'invalid-args',
    });
    expect(await call('yc:find-in-page', { text: 1 })).toMatchObject({
      ok: false,
      error: 'invalid-args',
    });
    expect(await call('yc:tab-toggle-mute', 1)).toMatchObject({ ok: false });
    expect(await call('yc:tab-get-preview', 1)).toMatchObject({ ok: false });
    expect(await call('yc:tab-set-split', null)).toMatchObject({ ok: true });
    expect(await call('yc:tab-set-split', 'nope')).toMatchObject({
      ok: false,
      error: 'invalid-tab',
    });
  });

  test('tab-activate and reopen handle not-found / empty stack', async () => {
    const services = makeServices({
      tabManager: {
        ...makeServices().tabManager!,
        activate: jest.fn(() => false),
        reopenClosed: jest.fn(() => null),
        duplicate: jest.fn(() => null),
      } as never,
    });
    const call = register(services);
    expect(await call('yc:tab-activate', 'ghost')).toMatchObject({
      ok: false,
      error: 'tab-not-found',
    });
    expect(await call('yc:tab-reopen-closed')).toMatchObject({
      ok: false,
      error: 'nothing-to-reopen',
    });
  });

  test('vault handlers report not-found, cancellation and invalid args', async () => {
    const call = register(makeServices());
    expect(await call('yc:vault-save', 1, 2)).toMatchObject({ ok: false, error: 'invalid-args' });
    expect(await call('yc:vault-delete', 'missing')).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    expect(await call('yc:vault-get', 'missing')).toMatchObject({ ok: false, error: 'not-found' });
    expect(await call('yc:vault-export', 'missing')).toMatchObject({
      ok: false,
      error: 'not-found',
    });
    expect(await call('yc:vault-reveal-doc', 'missing')).toMatchObject({
      ok: false,
      error: 'not-found',
    });
  });

  test('notification, biometric and theme guards', async () => {
    expect(
      await register(makeServices())('yc:show-notification', { title: 'T', body: 1 })
    ).toMatchObject({ ok: false });
    expect(
      await register(
        makeServices({
          biometricLock: {
            isAvailable: () => false,
            authenticate: () => Promise.resolve(false),
          } as never,
        })
      )('yc:authenticate-biometric')
    ).toMatchObject({ ok: false, error: 'biometric-not-available' });
    expect(
      await register(makeServices({ mainWindow: { isDestroyed: () => true } as never }))(
        'yc:apply-theme'
      )
    ).toMatchObject({ ok: false, error: 'no-window' });
  });

  test('open-patient-window validates id and requires a main window', async () => {
    expect(await register(makeServices())('yc:open-patient-window', 1)).toMatchObject({
      ok: false,
      error: 'invalid-patient-id',
    });
    expect(
      await register(makeServices({ mainWindow: { isDestroyed: () => true } as never }))(
        'yc:open-patient-window',
        'p1'
      )
    ).toMatchObject({ ok: false, error: 'no-main-window' });
  });

  test('every handler degrades safely when all services are unavailable', async () => {
    const call = register(
      makeServices({
        settingsStore: null,
        offlineCache: null,
        notificationManager: null,
        biometricLock: null,
        documentVault: null,
        syncEngine: null,
        offlineStore: null,
        auditLog: null,
        controlledSubstanceLog: null,
        csExport: null,
        deaTracker: null,
        tabManager: null,
        tabViewHost: null,
        recentsStore: null,
        mainWindow: null,
      })
    );
    const calls: Array<[string, unknown[]]> = [
      ['yc:get-settings', []],
      ['yc:set-settings', [{}]],
      ['yc:get-cache-status', []],
      ['yc:clear-cache', []],
      ['yc:get-cached-content', ['u']],
      ['yc:sync-now', []],
      ['yc:show-notification', [{ title: 'a', body: 'b' }]],
      ['yc:authenticate-biometric', ['r']],
      ['yc:apply-theme', []],
      ['yc:cs-record', [{}]],
      ['yc:cs-export', []],
      ['yc:audit-append', [{}]],
      ['yc:vault-save', ['f', 'c']],
      ['yc:vault-list', []],
      ['yc:vault-get', ['id']],
      ['yc:vault-delete', ['id']],
      ['yc:vault-stats', []],
      ['yc:vault-save-buffer', ['f', 'AA']],
      ['yc:vault-export', ['id']],
      ['yc:vault-reveal-doc', ['id']],
      ['yc:dea-register', [{}]],
      ['yc:tabs-get', []],
      ['yc:tab-new', ['https://yosemitecrew.com/x']],
      ['yc:tab-close', ['t']],
      ['yc:tab-activate', ['t']],
      ['yc:tab-move', ['t', 0]],
      ['yc:tab-pin', ['t', true]],
      ['yc:tab-duplicate', ['t']],
      ['yc:tab-reopen-closed', []],
      ['yc:tab-set-zoom', ['t', 1]],
      ['yc:tab-toggle-mute', ['t']],
      ['yc:tab-get-preview', ['t']],
      ['yc:tab-detach', ['t']],
      ['yc:tab-set-split', ['t']],
      ['yc:open-patient-window', ['p']],
    ];
    for (const [channel, args] of calls) {
      const result = await call(channel, ...args);
      expect(result).toMatchObject({ ok: false });
    }
  });
});
