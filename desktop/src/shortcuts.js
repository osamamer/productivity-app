/** Maps a key press to a window command; the app has no menu bar to provide these. */
function shortcutFor(input) {
    if (input.type !== 'keyDown') return null;
    const ctrl = input.control || input.meta;
    const key = input.key.toLowerCase();
    if (input.key === 'F11') return 'fullscreen';
    if (input.key === 'F12' || (ctrl && input.shift && key === 'i')) return 'devtools';
    if (!ctrl || input.alt) return null;
    if (key === 'r' && !input.shift) return 'reload';
    if (key === '=' || key === '+') return 'zoomIn';
    if (key === '-') return 'zoomOut';
    if (key === '0') return 'zoomReset';
    if (key === 'q') return 'quit';
    return null;
}

module.exports = { shortcutFor };
