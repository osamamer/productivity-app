const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, matchingUrlRule } = require('../src/timeouts/core/urls');

test('a bare domain becomes an https URL for the whole site', () => {
    assert.equal(normalizeUrl('YouTube.com'), 'https://youtube.com/');
});

test('a path keeps its scope without a trailing slash', () => {
    assert.equal(normalizeUrl('youtube.com/user/'), 'https://youtube.com/user');
});

test('URLs with credentials or fragments are refused', () => {
    assert.throws(() => normalizeUrl('https://me:secret@example.com'));
    assert.throws(() => normalizeUrl('example.com/#top'));
    assert.throws(() => normalizeUrl('ftp://example.com'));
});

test('a domain timer covers its subdomains and every path', () => {
    const rules = ['https://reddit.com/'];
    assert.equal(matchingUrlRule('https://old.reddit.com/r/adhd', rules), 'https://reddit.com/');
    assert.equal(matchingUrlRule('https://notreddit.com/', rules), null);
});

test('a path timer covers subpages but not similarly named paths', () => {
    const rules = ['https://youtube.com/user'];
    assert.equal(matchingUrlRule('https://www.youtube.com/user/videos', rules), 'https://youtube.com/user');
    assert.equal(matchingUrlRule('https://youtube.com/username', rules), null);
});

test('the most specific timer wins', () => {
    const rules = ['https://youtube.com/', 'https://youtube.com/shorts'];
    assert.equal(matchingUrlRule('https://youtube.com/shorts/abc', rules), 'https://youtube.com/shorts');
    assert.equal(matchingUrlRule('https://youtube.com/watch', rules), 'https://youtube.com/');
});
