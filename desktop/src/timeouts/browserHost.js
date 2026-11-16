const fs = require('node:fs');
const path = require('node:path');

const HOST_NAME = 'claritard_url_gate';
const EXTENSION_ID = 'url-gate@claritard.app';
const SOURCE_DIR = __dirname;

function shellQuote(value) {
    return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function manifestPath(paths) {
    return path.join(paths.firefoxHostManifestDir, `${HOST_NAME}.json`);
}

function isBrowserHostInstalled(paths) {
    return fs.existsSync(manifestPath(paths));
}

/**
 * Copies the native host out of the app bundle, because the AppImage's mount point (and so any
 * path inside it) changes on every run. Also records how to start Claritard for the host.
 */
function copyHostFiles(paths, command) {
    const target = paths.browserHostDir;
    fs.rmSync(path.join(target, 'core'), { recursive: true, force: true });
    fs.mkdirSync(path.join(target, 'core'), { recursive: true });
    fs.copyFileSync(path.join(SOURCE_DIR, 'nativeHost.js'), path.join(target, 'nativeHost.js'));
    for (const file of fs.readdirSync(path.join(SOURCE_DIR, 'core'))) {
        if (file.endsWith('.js')) fs.copyFileSync(path.join(SOURCE_DIR, 'core', file), path.join(target, 'core', file));
    }
    fs.writeFileSync(paths.launchCommandFile, `${JSON.stringify({ command }, null, 2)}\n`);
    const script = path.join(target, 'claritard-url-gate');
    fs.writeFileSync(script, `#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec ${command.slice(0, 1).map(shellQuote).join(' ')} ${shellQuote(path.join(target, 'nativeHost.js'))} "$@"\n`);
    fs.chmodSync(script, 0o755);
    return script;
}

/** Registers the host with Firefox so the Claritard URL Gate extension can reach it. */
function installBrowserHost(paths, command) {
    const script = copyHostFiles(paths, command);
    fs.mkdirSync(paths.firefoxHostManifestDir, { recursive: true });
    const manifest = {
        name: HOST_NAME,
        description: 'Claritard URL timer bridge',
        path: script,
        type: 'stdio',
        allowed_extensions: [EXTENSION_ID],
    };
    fs.writeFileSync(manifestPath(paths), `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Keeps an installed host pointing at the current copy of Claritard. */
function refreshBrowserHost(paths, command) {
    if (isBrowserHostInstalled(paths)) installBrowserHost(paths, command);
}

module.exports = { HOST_NAME, EXTENSION_ID, installBrowserHost, refreshBrowserHost, isBrowserHostInstalled };
