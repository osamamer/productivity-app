const crypto = require('node:crypto');

const LOCAL_SUBJECT = 'local-user';
const TOKEN_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;

function createAuthSecret() {
    return crypto.randomBytes(32);
}

function base64UrlJson(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/**
 * Signs the HS256 token the local backend accepts. The subject is fixed so the same local user
 * row owns the data across launches; the secret changes every launch, so a token is useless
 * once the app that issued it has quit. The long lifetime only avoids a refresh flow while the
 * app stays open.
 */
function signLocalToken(secret, { displayName, nowMs = Date.now() } = {}) {
    const issuedAt = Math.floor(nowMs / 1000);
    const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
    const payload = base64UrlJson({
        sub: LOCAL_SUBJECT,
        preferred_username: displayName || 'local',
        given_name: displayName || 'Local',
        family_name: '',
        iat: issuedAt,
        exp: issuedAt + TOKEN_LIFETIME_SECONDS,
    });
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
}

module.exports = { createAuthSecret, signLocalToken, LOCAL_SUBJECT };
