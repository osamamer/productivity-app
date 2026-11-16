const fs = require('node:fs');
const path = require('node:path');

const SIZES = ['48x48', '64x64', '96x96', '128x128', '256x256', 'scalable', '32x32', '512x512'];
const EXTENSIONS = ['.png', '.svg'];
const MAX_ICON_BYTES = 200_000;

function iconRoots(env = process.env) {
    const home = env.HOME;
    const dataHome = env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const dataDirs = (env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(Boolean);
    const flatpak = [path.join(dataHome, 'flatpak', 'exports', 'share'), '/var/lib/flatpak/exports/share'];
    return [...new Set([dataHome, ...dataDirs, ...flatpak])];
}

/**
 * A file for a launcher's `Icon=` value, looked up in the hicolor theme and pixmaps only.
 * Limitation: themed icons that exist only in the user's icon theme are not found.
 */
function findIconFile(icon, env = process.env) {
    if (!icon) return null;
    if (path.isAbsolute(icon)) return fs.existsSync(icon) ? icon : null;
    for (const root of iconRoots(env)) {
        for (const size of SIZES) {
            for (const extension of EXTENSIONS) {
                const candidate = path.join(root, 'icons', 'hicolor', size, 'apps', `${icon}${extension}`);
                if (fs.existsSync(candidate)) return candidate;
            }
        }
        for (const extension of EXTENSIONS) {
            const candidate = path.join(root, 'pixmaps', `${icon}${extension}`);
            if (fs.existsSync(candidate)) return candidate;
        }
    }
    return null;
}

/** A `data:` URL the settings page can show, or null when there is no usable icon. */
function iconDataUrl(icon, env = process.env) {
    const file = findIconFile(icon, env);
    if (!file) return null;
    const extension = path.extname(file).toLowerCase();
    if (!EXTENSIONS.includes(extension)) return null;
    try {
        if (fs.statSync(file).size > MAX_ICON_BYTES) return null;
        const type = extension === '.svg' ? 'image/svg+xml' : 'image/png';
        return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
    } catch {
        return null;
    }
}

module.exports = { iconDataUrl };
