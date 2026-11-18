// DPMS modes from KDE's dpms.xml.
const DPMS_ON = 0;

// KWin swaps in this fake output when every monitor is unplugged, so windows have somewhere to live.
const PLACEHOLDER_NAME = /^Placeholder-/;

/**
 * Whether anyone could be looking at the screen: some real output is connected and powered on.
 *
 * Each output is `{ name, dpmsSupported, mode }`, any of which may still be null before the
 * compositor has described it. Unknown counts as on, so a slow or missing report never hides
 * time that was really spent. An output that cannot report DPMS also counts as on.
 */
function anyDisplayOn(outputs) {
    for (const output of outputs) {
        if (output.name && PLACEHOLDER_NAME.test(output.name)) continue;
        if (output.dpmsSupported !== true || output.mode === null || output.mode === DPMS_ON) return true;
    }
    return false;
}

module.exports = { anyDisplayOn, DPMS_ON };
