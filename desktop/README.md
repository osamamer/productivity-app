# Claritard for Linux desktop

An Electron shell around the web app. On first launch the user picks where data lives:

- **On this computer (local mode)** — the app starts the bundled Spring Boot backend with the
  `desktop` profile. It runs a private PostgreSQL (embedded, loopback only, random port) under
  `~/.config/Claritard/local-data`, serves the bundled web app on `http://127.0.0.1:47830`, and
  needs no account. The window blocks every request that is not to that address, and remote
  push notifications are disabled, so nothing reaches the cloud.
- **In the cloud (cloud mode)** — the window runs the web app bundled with this desktop app
  (`resources/cloud-frontend`, served as `claritard://app` by `src/bundledWebApp.js`). Only API
  calls, sign-in and the live WebSocket go to https://claritard.com, so the app opens instantly
  and its interface matches this release rather than whatever the website currently serves. No
  local backend is started.

The window is frameless with the app's own header (`src/appWindow.js`, `src/ui/header.*`): the
header and the web app are separate views, the header follows the page's light or dark
background, and every command lives in its **⋮** menu (`src/appMenu.js`) instead of a menu bar.
Closing the window hides it to a tray icon (`src/tray.js`); the app, and in local mode its
backend, keep running so reminders still arrive. Quit from the tray menu, **⋮ → Quit** or
Ctrl+Q. Reminders appear as native desktop notifications (`src/desktopNotifications.js`)
because Electron cannot list service-worker notifications.
The storage choice can be changed from **⋮ → Change Storage Mode…** or **Settings → Account**.
Local and cloud data are separate; switching copies nothing.

## How cloud mode reaches the server

The bundled page's origin is `claritard://app`, so its requests to claritard.com are cross-origin.
Production allows that origin in the backend's CORS and WebSocket checks
(`APP_CORS_ALLOWED_ORIGINS`, `APP_WEBSOCKET_ALLOWED_ORIGIN_PATTERNS` in
`deployment/docker-compose.production.yml`) and in the Keycloak client's web origins, which
`deployment/deploy-production.sh` adds on every deploy. Sign-in uses the app's own page and a
direct token request, so no Keycloak redirect URI is needed. The page cannot read the website's
storage, so the first launch after this change asks the user to sign in again.

Running from source without `npm run build:resources` has no bundle; cloud mode then loads the
website instead.

## How local auth works

There is no Keycloak in local mode. Each launch, the shell generates a random secret, passes it
to the backend (`DESKTOP_AUTH_SECRET`), and signs an HS256 token for the fixed subject
`local-user`. The backend validates it as a normal resource-server JWT, so controllers,
WebSockets and `CurrentUserService` are unchanged. The preload script gives the token only to
the app's own page. Secret stats unlock without a password in local mode, because there is no
account password; the operating-system account protects local data.

## Commands

```bash
npm install                 # once
npm run build:resources     # backend JAR, local and cloud web builds, trimmed Java 21 runtime
npm start                   # run from source (uses ./resources)
npm test                    # shell unit tests
npm run dist                # build:resources + AppImage and .deb into ./dist
```

`build:resources` needs a full JDK 21 with `jmods` (default `/usr/lib/jvm/java-21-openjdk-amd64`,
override with `DESKTOP_JDK_HOME`). The cloud address is `CLOUD_ORIGIN` in `src/main.js`.

## Limitations

- Linux x86-64 only (the embedded PostgreSQL binaries are for that platform).
- Desktops without a tray (stock GNOME) show no icon; launching the app again reopens the
  hidden window.
- Port 47830 is fixed because it is baked into the local web build; if another program uses
  it, local mode shows an error.
- Calendar subscriptions the user adds still download their `.ics` feeds from the address the
  user entered; that is the only outbound traffic local mode can make, and only on request.

## Boundaries (app and Firefox time limits)

The web app's **Boundaries** page configures limits that this desktop app enforces on this
computer, in local and cloud mode alike. It replaces the separate App Timeout tool.

- **App pauses.** Choosing an app rewrites its launcher in `~/.local/share/applications` (a backup of
  the original is kept in `~/.local/share/Claritard/timeouts/originals`; turning the pause off
  restores it exactly). Opening the app then shows a countdown that only runs while its window is
  focused. Afterwards the app opens by itself, or after you click Open.
- **Auto-close.** Optionally the app is closed a set time after it opens: a small "closes in" window
  shows the time left, notifications warn at one minute and ten seconds, then the app gets SIGTERM
  and, five seconds later, SIGKILL (Flatpaks: `flatpak kill`). Sessions are saved to disk and a
  systemd user timer is armed as a backstop, so the limit holds even if Claritard quits.
- **Firefox site timers.** The **Claritard URL Gate** extension (`firefox-extension/`) sends timed
  sites to a countdown page. Opening one starts a Firefox session; every timed site opened in it
  shares that deadline, which survives closing Firefox. At the end Claritard closes Firefox.
  Setup: Boundaries → **Connect** (installs the native messaging host), then load the extension
  from **Open extension folder** in `about:debugging`, or build `dist/claritard-url-gate.xpi` with
  `npm run build:extension`. A permanent install needs the add-on signed on addons.mozilla.org
  (unlisted); Firefox Developer Edition can also install it unsigned with
  `xpinstall.signatures.required=false`. Firefox Beta and Release reject an unsigned `.xpi` as
  "corrupt". Install it once: the extension keeps a native port open (`{type: "watch"}`)
  and the host pushes new rules whenever `timeouts.json` changes, so changing timers in Claritard
  needs no reload or reinstall.

**Profiles are separate apps.** A launcher whose command passes `--profile <name>` (for example a
Nuclear light profile, `nuclear-music-player --profile calm`) is listed, paused and auto-closed on
its own: its processes are told apart from the default profile's by that argument, so closing one
never ends the other. Flatpak launchers are matched by app ID only and do not get this.

Launchers and timers start Claritard with `--timeout-*` switches (see `src/timeouts/cli.js`). If
Claritard is not running, it starts without a window just for the countdown or timer, then quits.
Countdown windows and the gate page use the colors of the web app's current theme.

Limitations, as with App Timeout: apps that are already running, started from a terminal, or
opened by another app through D-Bus skip the pause; launchers that run a shell script cannot be
tracked; Wayland compositors decide where the "closes in" window appears; and moving the AppImage
breaks the rewritten launchers until Claritard next starts (it re-points them then).

## Screen time

The Day page's **Plan and screen** card shows planned calendar events and focus sessions above
which app was in focus, minute by minute; the calendar's Day view shows the same as tall columns,
and the web app's Digital wellbeing page adds a report over the last week to year, read through
`getDailyTotals` (app time per local date, up to 370 days). It is opt-in, works in local and cloud mode alike, and
the data never leaves this computer. Code lives in `src/usage/` (`core/` is plain Node and unit
tested).

- **Focus.** Wayland hides other apps' windows, so only the compositor can tell which one has
  focus. Both desktops call back into the `app.claritard.Usage` D-Bus service this app owns
  (`dbus-next`, `src/usage/focusBus.js`) with the app id, caption, fullscreen state and process id
  of the focused window (`FocusWithPid`/`TitleWithPid`; the pid-less `Focus`/`Title` stay for a
  GNOME extension from an older release that the shell runs until the next login).
  - **KDE Plasma 6:** `src/usage/kwin/claritard-usage.js` runs inside KWin (copied to
    `~/.local/share/Claritard/usage/` and loaded over D-Bus as `claritard-usage`). Quitting unloads
    it; starting replaces any copy a crash left behind.
  - **GNOME 45+:** `src/usage/gnome/` is a GNOME Shell extension, installed to
    `~/.local/share/gnome-shell/extensions/claritard-usage@claritard.app/` and turned on through
    `org.gnome.Shell` when tracking starts, off when it stops. It only calls while the app owns its
    D-Bus name. GNOME looks for new extensions only at login, so the first time screen time is
    turned on the card asks for one log out and back in. A changed extension also needs a new
    login before the shell runs it.
- **Idle.** `powerMonitor.getSystemIdleTime()` is always 0 on Wayland desktops here, so idle comes
  from the compositor. On KDE, `src/usage/waylandIdle.js` speaks the `ext_idle_notifier_v1`
  protocol directly over the Wayland socket, using the input-only notification because media
  players hold idle inhibitors. Mutter has no such protocol and its IdleMonitor watches never fire
  while an inhibitor is held, so on GNOME `src/usage/mutterIdle.js` reads `GetIdletime` (which
  ignores inhibitors) when the timeout could first be reached and uses a user-active watch for
  resumed input. After 3 minutes without input the open segment ends, backdated to the last input,
  unless the focused window is fullscreen and playing sound (watching a video). The lock screen (ScreenSaver
  `ActiveChanged`: `org.freedesktop.ScreenSaver` on KDE, `org.gnome.ScreenSaver` on GNOME) and
  suspend also end it.
- **Sound.** `src/usage/audioWatcher.js` follows `pactl subscribe` and reads which streams are not
  corked; a stream counts for the focused window when its pid is the window's or a descendant
  (browsers play from a child process). A paused video corks its stream, so it stops counting.
  Inhibit-aware idle is no use here: some app nearly always holds an inhibitor, and the compositor
  does not say whose. Without `pactl`, or without a pid, fullscreen counts as playing.
- **Screens off (KDE).** `src/usage/waylandDisplays.js` binds KWin's `org_kde_kwin_dpms_manager`
  for every `wl_output`. While no real output is connected and powered on (all DPMS off, or every
  monitor unplugged so only KWin's `Placeholder-1` output is left) nothing counts, fullscreen
  included; the time shows as "away". A monitor turned off with its own button is only seen if it
  drops off the cable (DisplayPort usually does, some HDMI monitors do not). Shared Wayland
  plumbing is in `src/usage/waylandConnection.js`.
- **Brief visits.** Focus passes through windows for a moment when a switcher cycles, a window
  closes or an app starts. Visits to one app shorter than 5 s are recorded but left out when the
  page reads screen time (`dropBriefVisits` in `src/usage/core/segments.js`).
- **Storage.** One JSON-lines file per local date in `~/.local/share/Claritard/usage/days/`, holding
  app segments and the spans when tracking was running (the page uses those to tell "away" from
  "not tracked"). Segments are cut every 60 s, so a crash loses at most a minute. Settings are in
  `~/.config/Claritard/usage.json`; "Start at login" writes `~/.config/autostart/claritard.desktop`,
  which starts the app with `--hidden` (window stays in the tray).
- **Packaging.** `dbus-next` has an optional native dependency (`usocket`) that it only needs for
  passing file descriptors; it falls back to a plain socket without it. `npmRebuild` is off and the
  module is excluded from the package so electron-builder never tries to compile it.

Limitations: KDE Plasma 6 and GNOME 45+ only (other desktops show the reason on the card); time is only
recorded while Claritard runs; window titles are whatever the app puts in its title bar.
