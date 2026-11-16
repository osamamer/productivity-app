// Shared by the header and the ⋮ menu: adopt the web app's background so the window chrome
// matches its light or dark theme.
function parseRgb(color) {
    const match = /rgba?\(([^)]+)\)/.exec(color);
    if (!match) return null;
    const [red, green, blue, alpha = 1] = match[1].split(',').map(part => Number.parseFloat(part));
    return alpha === 0 ? null : { red, green, blue };
}

// eslint-disable-next-line no-unused-vars
function applyPageTheme(background) {
    const rgb = parseRgb(background);
    if (!rgb) return;
    const luminance = (0.2126 * rgb.red + 0.7152 * rgb.green + 0.0722 * rgb.blue) / 255;
    document.documentElement.style.setProperty('--bg', `rgb(${rgb.red}, ${rgb.green}, ${rgb.blue})`);
    document.body.classList.toggle('light', luminance > 0.55);
}
