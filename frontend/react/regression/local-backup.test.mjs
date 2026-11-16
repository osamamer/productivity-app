import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';
const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage };
const preferences = new Map();
const snapshots = new Map();
let server, backups, keycloak, response;
let calls = 0;
const snapshot = () => ({ version: 1, capturedAt: new Date().toISOString(), data: { Note: [{ title: 'Cloud copy' }] } });
before(async () => {
    globalThis.localStorage = {
        getItem: key => preferences.get(key) ?? null,
        setItem: (key, value) => preferences.set(key, value),
        removeItem: key => preferences.delete(key),
    };
    // Persistence is the system boundary; scheduling and concurrency run unchanged.
    globalThis.backupTestStorage = async (key, value, current = () => true) => {
        await Promise.resolve();
        if (!current()) return;
        if (value === null) snapshots.delete(key);
        else if (value !== undefined) snapshots.set(key, structuredClone(value));
        return snapshots.get(key);
    };
    server = await createServer({
        configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'silent',
        server: { middlewareMode: true, ws: false, watch: null },
        plugins: [{ name: 'backup-storage-boundary', enforce: 'pre', load(id) {
            if (id.endsWith('/backupStore.ts')) return 'export const accessBackup = (...args) => globalThis.backupTestStorage(...args);';
        } }],
    });
    ({ default: keycloak } = await server.ssrLoadModule('/src/services/keycloak.ts'));
    keycloak.tokenParsed = { sub: 'owner' };
    keycloak.token = 'test-session';
    backups = await server.ssrLoadModule('/src/services/backup/localBackup.ts');
    globalThis.fetch = async (_url, options) => {
        calls++;
        assert.equal(options.headers.Authorization, 'Bearer test-session');
        return response ? response() : Response.json(snapshot());
    };
});
after(async () => {
    Object.assign(globalThis, original);
    delete globalThis.backupTestStorage;
    await server?.close();
});
test('opt-in, daily cloud replacement, failed-refresh retention, and account isolation', async () => {
    await backups.refreshBackup();
    assert.equal(calls, 0);
    await backups.setBackupsEnabled(true);
    await backups.refreshBackup();
    assert.equal(calls, 1);
    await backups.refreshBackup();
    assert.equal(calls, 1);
    const saved = await backups.readBackup();
    saved.capturedAt = '2020-01-01T00:00:00Z';
    saved.data.Note.push({ title: 'Deleted in cloud' });
    await backups.refreshBackup();
    assert.equal(calls, 2);
    assert.equal((await backups.readBackup()).data.Note.length, 1);
    response = () => Response.json({}, { status: 503 });
    await assert.rejects(backups.refreshBackup(true));
    assert.equal((await backups.readBackup()).data.Note[0].title, 'Cloud copy');
    keycloak.tokenParsed = { sub: 'another-account' };
    assert.equal(backups.backupsEnabled(), false);
    assert.equal(await backups.readBackup(), undefined);
    keycloak.tokenParsed = { sub: 'owner' };
    response = undefined;
});
test('disabling during a delayed refresh removes the copy and rejects the late result', async () => {
    let release;
    response = () => new Promise(resolve => { release = resolve; });
    const refresh = backups.refreshBackup(true);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    await backups.setBackupsEnabled(false);
    release(Response.json(snapshot()));
    await refresh;
    assert.equal(await backups.readBackup(), undefined);
    assert.equal(snapshots.size, 0);
    response = undefined;
});
test('rapid enable-disable-enable keeps the newest preference and refreshes its copy', async () => {
    await backups.setBackupsEnabled(true);
    let release;
    response = () => new Promise(resolve => { release = resolve; });
    const first = backups.refreshBackup(true);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    const disable = backups.setBackupsEnabled(false);
    await backups.setBackupsEnabled(true);
    const newest = backups.refreshBackup(true);
    response = undefined;
    release(Response.json(snapshot()));
    await Promise.all([disable, first, newest]);
    assert.equal(backups.backupsEnabled(), true);
    assert.equal((await backups.readBackup()).data.Note[0].title, 'Cloud copy');
});
test('the standalone viewer escapes stored text and cannot execute scripts', async () => {
    const { backupDocument } = await server.ssrLoadModule('/src/services/backup/backupDocument.ts');
    const html = backupDocument({ ...snapshot(), data: { Note: [{ title: '<script>alert(1)</script>' }] } });
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes("default-src 'none'"));
});
