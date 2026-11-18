# claritard-boundaries (Android)

Native side of the mobile app's Boundaries screens, ported from the Guard Bear app blocker.
Autolinked as a local Expo module; there is no iOS or web implementation (`Boundaries` is null there).

- `BoundariesAccessibilityService` is the enforcement point: on every foreground-window change it
  checks the app's rule and sends the user home when the app is blocked, out of time or out of
  opens. It also ticks once a second to count time. Its messages ("open 2 of 3", "1 minute left")
  are drawn by `BoundaryToast` as accessibility overlays in the colors the app last reported.
- `UsageTracker` counts today's minutes and opens. An open is an unlock: once unlocked, the app
  can be left and reopened freely until the screen locks or turns off, the open's time runs out,
  or it is kicked out. Time only counts while the screen is on and unlocked; counts reset at local
  midnight.
- `BoundaryDelayOverlay` is the "pause before opening": a full-screen countdown (styled like the
  desktop countdown window) drawn over a locked app before it unlocks. Leaving the app or turning
  the screen off resets it, but a return within three seconds resumes it, because foreground
  detection flickers during app transitions. It keeps the screen on while counting (and for a
  minute after) so a screen timeout can't lock the phone and restart a long wait. When it ends
  the app unlocks by itself or after tapping Open.
- `BoundariesPrefs` keeps rules and the two password hashes (PBKDF2) in EncryptedSharedPreferences.
  Adding or tightening a rule is free; loosening or removing one needs the master password (checked
  by the UI with `isLooser` in `src/lib/boundaryRules.ts`). The unlock password opens the screens
  and pauses enforcement for five minutes (`AutoResumeReceiver` resumes it).
- `ShizukuBridge` + `BoundariesShellService` optionally force-stop blocked apps with adb-shell
  privilege, and can turn the accessibility service on where Android marks it "restricted" for
  sideloaded apps. Shizuku's server must be restarted after every reboot on unrooted phones.
- `BoundariesAdminReceiver` (device admin) and the service's uninstall guard add friction to
  uninstalling Claritard. Neither is a guarantee: ADB, safe mode or a factory reset still work.
- `BoundariesPackage` starts the status notification service and Shizuku listeners when the app
  process starts, once passwords are set; `BoundariesBootReceiver` does the same after a reboot.

Android will not let an app enable its own accessibility service; the user turns it on once in
Settings. Google Play restricts accessibility-based blockers, so this suits sideloaded builds.
