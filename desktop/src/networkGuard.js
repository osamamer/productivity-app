const INTERNAL_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'devtools:', 'chrome:', 'chrome-extension:']);

/**
 * In local mode the window may talk only to the bundled backend on loopback. Everything else,
 * including fonts or scripts the web build would normally fetch from the internet, is refused.
 */
function isAllowedLocalRequest(requestUrl, backendOrigin) {
    let url;
    try {
        url = new URL(requestUrl);
    } catch {
        return false;
    }
    if (INTERNAL_PROTOCOLS.has(url.protocol)) return true;
    const backend = new URL(backendOrigin);
    return (url.protocol === 'http:' || url.protocol === 'ws:') && url.host === backend.host;
}

function installLocalNetworkGuard(electronSession, backendOrigin) {
    electronSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
        const allowed = isAllowedLocalRequest(details.url, backendOrigin);
        if (!allowed) console.warn(`Local mode blocked a network request to ${new URL(details.url).origin}`);
        callback({ cancel: !allowed });
    });
}

module.exports = { isAllowedLocalRequest, installLocalNetworkGuard };
