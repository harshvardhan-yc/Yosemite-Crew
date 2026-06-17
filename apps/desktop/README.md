# Yosemite Crew PIMS Desktop

This workspace packages the production Yosemite Crew PIMS web experience as a desktop app for macOS, Windows, and Linux. It intentionally does not include the mobile app or the developer portal.

## Runtime Scope

- Default entry URL: `https://www.yosemitecrew.com/signin`
- In-app origins: `https://www.yosemitecrew.com`, `https://yosemitecrew.com`
- Developer routes such as `/developers/signup` and `/developers/home` open in the system browser instead of the desktop shell.
- Top-level navigation to external sites opens in the system browser.
- Authentication state is stored in Electron's persistent `persist:yosemitecrew-pims` profile, so staff stay signed in across launches.

## Desktop Experience

- **Loading splash** is shown immediately on launch instead of a blank window while the workspace connects.
- **Offline page** with Retry / Open-in-browser replaces silent failures when the network is unavailable; the saved session is preserved.
- **In-app document windows**: PIMS popups plus explicitly allowed document origins open in a secure in-app window. Untrusted external popup origins open in the system browser instead.
- **Downloads** prompt for a save location and reveal the finished file in the OS file manager.
- **Print** the current view with `Cmd/Ctrl+P`.
- **Edit menu and right-click menu** provide undo/redo, cut/copy/paste, select-all, spellcheck suggestions, and copy-link.
- **Window size, position, maximized state and zoom level** persist between launches (stored in `window-state.json` under the app's user-data directory).
- **Crash & hang recovery**: if the page process crashes the workspace reloads automatically; if it hangs you're offered a Reload.
- **Native notifications**: web notifications surface as native OS notifications (the `notifications` permission is allowed for PIMS origins).
- **Deep linking**: the app registers the `yosemitecrew://` scheme. A link like `yosemitecrew://appointments/123` focuses the app and opens the matching page (`https://www.yosemitecrew.com/appointments/123`). Deep links that resolve to external or developer-portal routes are ignored.
- **GetStream telehealth**: desktop telehealth is GetStream-only. PIMS can launch calls through `window.ycDesktop.startTelehealth({ appointmentId, callId })`; backend/PIMS owns Stream call creation and tokens.
- **Sync controls**: Preferences shows sync status and exposes a manual **Sync now** action. Without `YC_DESKTOP_SYNC_URL`, local changes are reported as blocked instead of silently pretending to sync.
- **Local data clearing**: Preferences includes a confirmed action to clear local cache, vault entries, command recents, sync queue, and Electron storage.
- The window title reflects the current page.

Child document windows can be closed with `Cmd/Ctrl+W`.

The app icon is generated from `resources/source-icon.png` into `icon.png` (512²), `icon.icns` (macOS) and `icon.ico` (Windows).

## Commands

From the monorepo root:

```sh
pnpm install
pnpm desktop:build
pnpm desktop:test
pnpm desktop:security
pnpm desktop:archlint
pnpm --filter @yosemite-crew/desktop run desktop:notices
pnpm desktop:dev
pnpm desktop:pack
pnpm --filter @yosemite-crew/desktop exec playwright test --config playwright.config.ts
pnpm desktop:dist:mac
pnpm desktop:dist:win
pnpm desktop:dist:linux
```

`desktop:pack` creates an unpacked local app under `apps/desktop/dist`. The `desktop:dist:*` commands create distributable artifacts for each platform.
Run `desktop:pack` before the Playwright command; the E2E suite launches the packaged app from `dist`.

## Runtime Hardening

- TypeScript is the source of truth. `pnpm desktop:build` compiles `src/*.ts` into `build/*.js`, and Electron runs `build/main.js`.
- ESLint validates TypeScript, build scripts, and Jest tests.
- IPC is deny-by-default: only known channels are registered, unexpected arguments are rejected, and calls must originate from bundled local pages or allowed PIMS origins.
- Electron fuses are applied in `afterPack`: `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, and CLI inspect flags are disabled; cookie encryption and asar integrity checks are enabled; file protocol extra privileges remain enabled because local welcome/loading/offline pages use `file://` loading.
- Structured logs are written to the OS log directory as JSON lines with sensitive fields redacted.
- Crash reporting writes local crash dumps by default. Set `YC_DESKTOP_CRASH_UPLOAD_URL` only when a server-side crash intake endpoint exists.

## Auto-update

The app updates itself via [`electron-updater`](https://www.electron.build/auto-update), reading releases from GitHub (`YosemiteCrew/Yosemite-Crew`, configured under `build.publish` in `package.json`).

- On launch (packaged builds only) the app checks for a newer release, downloads it in the background, and prompts the user to **Restart Now** when it's ready.
- A manual **Check for Updates…** item is available in the app menu (macOS) and the **Help** menu (Windows/Linux).
- Updates are disabled automatically in dev (`electron .`) and can be force-disabled with `YC_DESKTOP_DISABLE_UPDATES=1`.
- The update channel defaults to `latest`; set `YC_DESKTOP_UPDATE_CHANNEL=beta` for beta feed checks.

Publishing a release (requires a `GH_TOKEN` with `repo` scope, and signed builds — unsigned macOS apps cannot auto-install):

```sh
export GH_TOKEN=...        # personal access token with repo scope
pnpm desktop:publish       # builds mac + win and uploads to a GitHub release (draft)
```

`electron-updater` reads the `latest-mac.yml` / `latest.yml` feed files that `electron-builder` generates next to the artifacts. These are only produced by the installer builds (`desktop:dist:*` / `desktop:publish`), not by `desktop:pack`.

## Environment Overrides

Use these only for staging or QA builds:

```sh
YC_DESKTOP_START_URL=https://staging.yosemitecrew.com/signin
YC_DESKTOP_ALLOWED_ORIGINS=https://staging.yosemitecrew.com
YC_DESKTOP_IN_APP_POPUP_ORIGINS=https://staging-cdn.yosemitecrew.com
YC_DESKTOP_BLOCKED_PATH_PREFIXES=/developers,/dev-docs
YC_DESKTOP_PARTITION=persist:yosemitecrew-pims-staging
YC_DESKTOP_DISABLE_UPDATES=1
YC_DESKTOP_UPDATE_CHANNEL=beta
YC_DESKTOP_TELEMETRY=1
YC_DESKTOP_IDLE_LOCK_MINUTES=15
YC_DESKTOP_CRASH_UPLOAD_URL=
YC_DESKTOP_SYNC_URL=
```

## Signing

Local builds can be unsigned. For production distribution:

- macOS: configure `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`. The build uses hardened runtime entitlements and notarizes in `scripts/notarize.js` when those values are present.
- Windows: configure Authenticode signing credentials with `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`.
- Notarization dry run: set `YC_DESKTOP_NOTARIZE_DRY_RUN=1` to exercise the release packaging path without contacting Apple.

Keep all signing credentials out of the repository.

### Local development & keychain prompts (macOS)

Each local `desktop:pack` re-signs the app **ad-hoc**, which produces a _new_ code-signature identity every build. macOS keychain ACLs are tied to that identity, so on the first launch after each rebuild you'll see one or more keychain prompts:

- **Cookie encryption** (the `EncryptCookies` fuse stores Chromium's cookie key in the login keychain).
- **Audit-log key** (the compliance audit trail's HMAC key is stored via `safeStorage`).

Click **Always Allow** on each (you may be asked for your login password). This is expected and only happens once per build. If a prompt is dismissed, the initial navigation can stall — the cold-start watchdog will retry after ~6s, or use **File → Home**.

To avoid the re-prompt churn during heavy local iteration, sign with a **stable self-signed certificate** instead of ad-hoc so the identity (and keychain ACL) persists across rebuilds:

```sh
# one-time: create a self-signed code-signing cert named "YC Dev" in your login keychain
# (Keychain Access ▸ Certificate Assistant ▸ Create a Certificate… ▸ Code Signing)
export CSC_NAME="YC Dev"
pnpm --dir apps/desktop run desktop:pack   # electron-builder signs with CSC_NAME
```

The packaged `dev:run`/`desktop:dev` path (running Electron directly against source) does not trigger these prompts.

### macOS certificate setup

1. In Apple Developer, create or locate a **Developer ID Application** certificate for the Yosemite Crew team.
2. Import the certificate into Keychain Access, then export it as a password-protected `.p12`.
3. Convert the `.p12` to base64 for GitHub Actions:

```sh
base64 -i DeveloperIDApplication.p12 | pbcopy
```

4. Store the base64 value as `MAC_CSC_LINK` and the `.p12` password as `MAC_CSC_KEY_PASSWORD`.
5. Create an Apple app-specific password and store `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`.
6. Run the release workflow and verify the `.dmg` notarizes, staples, and passes Gatekeeper on a clean Mac.

### Windows certificate setup

1. Obtain an OV/EV Authenticode code-signing certificate as `.pfx` / `.p12`.
2. Convert it to base64:

```sh
base64 -i YosemiteCrewWindowsSigning.pfx | pbcopy
```

3. Store the base64 value as `WIN_CSC_LINK` and the certificate password as `WIN_CSC_KEY_PASSWORD`.
4. Run the release workflow on `windows-latest`.
5. Verify the NSIS installer and portable EXE are signed and install cleanly on a Windows machine.

## CI / Release

Two workflows drive the desktop app:

- `.github/workflows/desktop-ci.yml` — runs on PRs/pushes touching `apps/desktop`: type-check, lint, tests + coverage, and security-pressure checks.
- `.github/workflows/desktop-coverage.yml` — uploads the Jest coverage directory as a separate artifact without editing the main desktop CI workflow.
- `.github/workflows/desktop-e2e.yml` — packages and runs Playwright E2E against the native desktop app.
- `.github/workflows/desktop-release.yml` — builds macOS + Windows and publishes to GitHub Releases (electron-updater feed) when a `desktop-v*` tag is pushed, or via manual dispatch.

Configure these GitHub Actions repository secrets before publishing a signed release (all optional — unset secrets simply skip signing/notarization, and the build still succeeds unsigned):

| Secret                        | Purpose                                        |
| ----------------------------- | ---------------------------------------------- |
| `MAC_CSC_LINK`                | base64 of the macOS Developer ID `.p12`        |
| `MAC_CSC_KEY_PASSWORD`        | password for the `.p12`                        |
| `APPLE_ID`                    | Apple ID used for notarization                 |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password for notarization         |
| `APPLE_TEAM_ID`               | Apple Developer Team ID                        |
| `WIN_CSC_LINK`                | base64 of the Windows code-signing certificate |
| `WIN_CSC_KEY_PASSWORD`        | password for the Windows certificate           |

`GH_TOKEN` is provided automatically by Actions (`secrets.GITHUB_TOKEN`).

### Release runbook

1. Bump `version` in `apps/desktop/package.json`.
2. Commit, then tag and push: `git tag desktop-v<version> && git push origin desktop-v<version>`.
3. `desktop-release.yml` builds both platforms, signs/notarizes if secrets are present, and uploads artifacts plus the `latest-mac.yml` / `latest.yml` update feeds to a GitHub Release (created as a draft).
4. Review the draft Release, confirm the feed files are attached, and publish it.
5. Existing installs pick up the update on next launch (or via **Check for Updates…**). macOS auto-install requires a signed + notarized build.

## Notices, Architecture, and Perf

- `THIRD-PARTY-NOTICES.md` is generated from installed desktop dependencies with `pnpm --filter @yosemite-crew/desktop run desktop:notices`.
- `docs/desktop-architecture.md` documents process boundaries, navigation/IPC trust boundaries, hardening, and update-channel behavior.
- `docs/desktop-perf.md` records cold-start and idle RSS measurements from `scripts/measure-startup.js` after `desktop:pack` succeeds.
- `docs/update-feed-threat-model.md` documents update-feed risks, signing checks, and publisher verification follow-ups.
