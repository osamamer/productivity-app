const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createAuthSecret, signLocalToken, LOCAL_SUBJECT } = require('../src/localToken');

function decode(part) {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

test('the local token is an HS256 JWT signed with the launch secret', () => {
    const secret = createAuthSecret();
    const [header, payload, signature] = signLocalToken(secret).split('.');
    assert.deepEqual(decode(header), { alg: 'HS256', typ: 'JWT' });
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    assert.equal(signature, expected);
});

test('every launch uses the same local user so data stays with it', () => {
    const first = decode(signLocalToken(createAuthSecret()).split('.')[1]);
    const second = decode(signLocalToken(createAuthSecret()).split('.')[1]);
    assert.equal(first.sub, LOCAL_SUBJECT);
    assert.equal(second.sub, LOCAL_SUBJECT);
});

test('the token carries the display name and an expiry after its issue time', () => {
    const claims = decode(signLocalToken(createAuthSecret(), { displayName: 'sam', nowMs: 1_000_000 }).split('.')[1]);
    assert.equal(claims.preferred_username, 'sam');
    assert.equal(claims.iat, 1000);
    assert.ok(claims.exp > claims.iat);
});

test('a token from one launch does not verify against the next launch secret', () => {
    const [header, payload, signature] = signLocalToken(createAuthSecret()).split('.');
    const other = crypto.createHmac('sha256', createAuthSecret()).update(`${header}.${payload}`).digest('base64url');
    assert.notEqual(signature, other);
});
