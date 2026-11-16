const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedLocalRequest } = require('../src/networkGuard');

const backend = 'http://127.0.0.1:47830';

test('local mode may reach the bundled backend over HTTP and WebSocket', () => {
    assert.ok(isAllowedLocalRequest('http://127.0.0.1:47830/api/v1/tasks', backend));
    assert.ok(isAllowedLocalRequest('ws://127.0.0.1:47830/ws', backend));
});

test('local mode may load the app own pages and in-memory resources', () => {
    assert.ok(isAllowedLocalRequest('file:///opt/Claritard/resources/app/src/ui/starting.html', backend));
    assert.ok(isAllowedLocalRequest('data:image/png;base64,AAAA', backend));
    assert.ok(isAllowedLocalRequest('blob:http://127.0.0.1:47830/1234', backend));
});

test('local mode refuses every internet request', () => {
    assert.equal(isAllowedLocalRequest('https://fonts.googleapis.com/css2?family=Raleway', backend), false);
    assert.equal(isAllowedLocalRequest('https://app.example.com/api/v1/tasks', backend), false);
    assert.equal(isAllowedLocalRequest('wss://app.example.com/ws', backend), false);
});

test('other ports on this machine are refused too', () => {
    assert.equal(isAllowedLocalRequest('http://127.0.0.1:8080/api/v1/tasks', backend), false);
    assert.equal(isAllowedLocalRequest('http://localhost:47830/api/v1/tasks', backend), false);
});
