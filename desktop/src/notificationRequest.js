const MAX_TITLE = 200;
const MAX_BODY = 1000;
const MAX_TAG = 200;

function text(value, maxLength) {
    return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

/**
 * Validates a notification request from the web page. Only an in-app path is accepted as the
 * click target, so a notification can never send the window to another site.
 */
function sanitizeNotificationRequest(input) {
    const title = text(input?.title, MAX_TITLE).trim();
    if (!title) return null;
    const targetUrl = typeof input?.targetUrl === 'string'
        && input.targetUrl.startsWith('/')
        && !input.targetUrl.startsWith('//')
        ? input.targetUrl
        : null;
    return {
        title,
        body: text(input?.body, MAX_BODY),
        tag: text(input?.tag, MAX_TAG) || null,
        targetUrl,
    };
}

module.exports = { sanitizeNotificationRequest };
