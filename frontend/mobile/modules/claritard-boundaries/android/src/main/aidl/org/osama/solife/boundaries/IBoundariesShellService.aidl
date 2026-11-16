package org.osama.solife.boundaries;

// Runs inside the privileged process Shizuku spawns (adb-shell UID). Kept deliberately tiny -
// a couple of shell operations, plus the destroy method Shizuku's own server expects.
interface IBoundariesShellService {

    void destroy() = 16777114; // Reserved transaction id Shizuku's server calls to stop the service.

    void forceStopPackage(String packageName) = 1;

    // Adds the given flattened component to Settings.Secure enabled_accessibility_services
    // (keeping any already enabled) and turns accessibility on. Returns true if the setting
    // reads back containing the component afterwards.
    boolean enableAccessibilityService(String flattenedComponent) = 2;
}
