# Claritard for Linux desktop

An Electron shell around the web app. On first launch the user picks where data lives:

- **On this computer (local mode)** — the app starts the bundled Spring Boot backend with the
  `desktop` profile. It runs a private PostgreSQL (embedded, loopback only, random port) under
  `~/.config/Claritard/local-data`, serves the bundled web app on `http://127.0.0.1:47830`, and
  needs no account. The window blocks every request that is not to that address, and remote
  push notifications are disabled, so nothing reaches the cloud.
- **In the cloud (cloud mode)** — the window loads https://claritard.com and signs in through
  Keycloak as usual. No local backend is started.

The window is frameless with the app's own header (`src/appWindow.js`, `src/ui/header.*`): the
header and the web app are separate views, the header follows the page's light or dark
background, and every command lives in its **⋮** menu (`src/appMenu.js`) instead of a menu bar.
Closing the window hides it to a tray icon (`src/tray.js`); the app, and in local mode its
backend, keep running so reminders still arrive. Quit from the tray menu, **⋮ → Quit** or
Ctrl+Q. Reminders appear as native desktop notifications (`src/desktopNotifications.js`)
because Electron cannot list service-worker notifications.
The storage choice can be changed from **⋮ → Change Storage Mode…** or **Settings → Account**.
Local and cloud data are separate; switching copies nothing.

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
npm run build:resources     # backend JAR, local web build, trimmed Java 21 runtime
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
  `xpinstall.signatures.required=false`.

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
which app was in focus, minute by minute. It is opt-in, works in local and cloud mode alike, and
the data never leaves this computer. Code lives in `src/usage/` (`core/` is plain Node and unit
tested).

- **Focus.** Wayland hides other apps' windows, so `src/usage/kwin/claritard-usage.js` runs inside
  KWin (copied to `~/.local/share/Claritard/usage/` and loaded over D-Bus as `claritard-usage`) and
  calls back into the `app.claritard.Usage` D-Bus service this app owns (`dbus-next`) with the
  desktop file name, caption and fullscreen state of the focused window. Quitting unloads it;
  starting replaces any copy a crash left behind.
- **Idle.** `powerMonitor.getSystemIdleTime()` is always 0 on KDE Wayland and KDE does not implement
  `GetSessionIdleTime`, so `src/usage/waylandIdle.js` speaks the `ext_idle_notifier_v1` protocol
  directly over the Wayland socket. It uses the input-only notification because media players hold
  idle inhibitors. After 3 minutes without input the open segment ends, backdated to the last input,
  unless the focused window is fullscreen (watching a video). The lock screen (ScreenSaver
  `ActiveChanged`) and suspend also end it.
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

Limitations: KDE Plasma 6 only for now (other desktops show the reason on the card); time is only
recorded while Claritard runs; window titles are whatever the app puts in its title bar.
