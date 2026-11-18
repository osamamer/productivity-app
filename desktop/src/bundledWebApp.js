const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/**
 * Cloud mode runs the web app bundled with this desktop app instead of loading it from the
 * website. Pages come from `claritard://app`; only API calls, sign-in and the live WebSocket go
 * to the cloud. The cloud's backend and Keycloak must allow this origin for CORS (see
 * deployment/deploy-production.sh and APP_CORS_ALLOWED_ORIGINS).
 */
const SCHEME = 'claritard';
const HOST = 'app';
const BUNDLED_ORIGIN = `${SCHEME}://${HOST}`;

/** Must run before the app is ready. */
function registerBundledScheme(protocol) {
    protocol.registerSchemesAsPrivileged([{
        scheme: SCHEME,
        privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, stream: true },
    }]);
}

/**
 * The file to serve for a request, or null for a 404. Paths with no matching file and no
 * extension are app routes, so they get index.html like the website's `try_files`.
 */
function bundledFilePath(requestUrl, rootDir, exists = fs.existsSync) {
    let url;
    try {
        url = new URL(requestUrl);
    } catch {
        return null;
    }
    if (url.protocol !== `${SCHEME}:` || url.host !== HOST) return null;

    let relative;
    try {
        relative = decodeURIComponent(url.pathname);
    } catch {
        return null;
    }
    const root = path.resolve(rootDir);
    const candidate = path.resolve(root, `.${relative}`);
    if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;

    if (candidate !== root && exists(candidate) && !isDirectory(candidate)) return candidate;
    if (path.extname(relative)) return null;
    return path.join(root, 'index.html');
}

function isDirectory(file) {
    try {
        return fs.statSync(file).isDirectory();
    } catch {
        return false;
    }
}

/** True when `requestUrl` is a page of the bundled app. */
function isBundledAppUrl(requestUrl) {
    try {
        const url = new URL(requestUrl);
        return url.protocol === `${SCHEME}:` && url.host === HOST;
    } catch {
        return false;
    }
}

function serveBundledWebApp(electronSession, net, rootDir) {
    // The window can be reopened after it was closed, which launches cloud mode again.
    if (electronSession.protocol.isProtocolHandled(SCHEME)) return;
    electronSession.protocol.handle(SCHEME, request => {
        const file = bundledFilePath(request.url, rootDir);
        if (!file) return new Response('Not found', { status: 404 });
        return net.fetch(pathToFileURL(file).toString());
    });
}

function hasBundledWebApp(rootDir) {
    return fs.existsSync(path.join(rootDir, 'index.html'));
}

module.exports = {
    BUNDLED_ORIGIN,
    registerBundledScheme,
    bundledFilePath,
    isBundledAppUrl,
    serveBundledWebApp,
    hasBundledWebApp,
};
