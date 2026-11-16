const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeNotificationRequest } = require('../src/notificationRequest');

test('a notification from the page keeps its text, tag and in-app target', () => {
    assert.deepEqual(
        sanitizeNotificationRequest({ title: 'Break time', body: 'Stretch', tag: 'productivity-1', targetUrl: '/tasks/1' }),
        { title: 'Break time', body: 'Stretch', tag: 'productivity-1', targetUrl: '/tasks/1' },
    );
});

test('a notification needs a title', () => {
    assert.equal(sanitizeNotificationRequest({ title: '   ' }), null);
    assert.equal(sanitizeNotificationRequest(null), null);
});

test('clicking can only open a page inside the app', () => {
    assert.equal(sanitizeNotificationRequest({ title: 'x', targetUrl: 'https://example.com' }).targetUrl, null);
    assert.equal(sanitizeNotificationRequest({ title: 'x', targetUrl: '//example.com/tasks' }).targetUrl, null);
    assert.equal(sanitizeNotificationRequest({ title: 'x', targetUrl: '/calendar?event=2' }).targetUrl, '/calendar?event=2');
});

test('oversized text is trimmed and missing fields become empty', () => {
    const notification = sanitizeNotificationRequest({ title: 'a'.repeat(500), body: 42 });
    assert.equal(notification.title.length, 200);
    assert.equal(notification.body, '');
    assert.equal(notification.tag, null);
});
