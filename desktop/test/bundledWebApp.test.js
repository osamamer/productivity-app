const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { bundledFilePath, isBundledAppUrl } = require('../src/bundledWebApp');

const root = path.resolve('/opt/Claritard/resources/cloud-frontend');
const files = new Set([
    path.join(root, 'index.html'),
    path.join(root, 'assets', 'index-abc.js'),
    path.join(root, 'service-worker.js'),
]);
const exists = file => files.has(file);
const resolve = url => bundledFilePath(url, root, exists);

test('serves bundled files by path', () => {
    assert.equal(resolve('claritard://app/assets/index-abc.js'), path.join(root, 'assets', 'index-abc.js'));
    assert.equal(resolve('claritard://app/service-worker.js?v=2'), path.join(root, 'service-worker.js'));
});

test('app routes fall back to index.html, like the website', () => {
    assert.equal(resolve('claritard://app/'), path.join(root, 'index.html'));
    assert.equal(resolve('claritard://app/tasks/123'), path.join(root, 'index.html'));
    assert.equal(resolve('claritard://app/sign-in?next=%2Fday'), path.join(root, 'index.html'));
});

test('missing files with an extension are not found instead of returning the page', () => {
    assert.equal(resolve('claritard://app/assets/missing.js'), null);
});

test('never serves files outside the bundle', () => {
    for (const url of [
        'claritard://app/%2e%2e/backend.jar',
        'claritard://app/..%2Fbackend.jar',
        'claritard://app/%2E%2E%2F%2E%2E%2Fetc%2Fpasswd',
        'claritard://app/..%2F..%2Fetc',
    ]) {
        const file = resolve(url);
        assert.ok(file === null || file.startsWith(root + path.sep), `${url} resolved to ${file}`);
    }
    assert.equal(resolve('claritard://app/..%2Fbackend.jar'), null);
});

test('ignores other schemes and hosts', () => {
    assert.equal(resolve('https://claritard.com/index.html'), null);
    assert.equal(resolve('claritard://other/index.html'), null);
});

test('recognizes pages of the bundled app', () => {
    assert.equal(isBundledAppUrl('claritard://app/day'), true);
    assert.equal(isBundledAppUrl('https://claritard.com/day'), false);
});

test('files the cloud bundle leaves out, like the audio, come from the shared local bundle', () => {
    const shared = path.resolve('/opt/Claritard/resources/frontend');
    const sharedFiles = new Set([...files, path.join(shared, 'audio', 'rain.mp3'), path.join(shared, 'secret.txt')]);
    const resolveShared = url => bundledFilePath(url, root, file => sharedFiles.has(file), shared);
    assert.equal(resolveShared('claritard://app/audio/rain.mp3'), path.join(shared, 'audio', 'rain.mp3'));
    assert.equal(resolveShared('claritard://app/assets/index-abc.js'), path.join(root, 'assets', 'index-abc.js'));
    assert.equal(resolveShared('claritard://app/audio/missing.mp3'), null);
});
