const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { timeoutPaths } = require('../src/timeouts/core/paths');
const { Launchers } = require('../src/timeouts/core/launchers');
const { installedLaunchers } = require('../src/timeouts/core/installedApps');
const { grantBrowserRule, browserRulesResponse, readSession } = require('../src/timeouts/core/browserSession');
const { appSettings, urlSettings, emptyConfig } = require('../src/timeouts/core/config');

const SELF = ['/opt/Claritard/claritard'];

/** A fake home with one installed app whose binary is never running. */
function fakeSystem() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claritard-timeouts-'));
    const home = path.join(root, 'home');
    const binary = path.join(root, 'bin', 'focus-thief');
    const systemApps = path.join(root, 'usr', 'share', 'applications');
    fs.mkdirSync(path.dirname(binary), { recursive: true });
    fs.mkdirSync(systemApps, { recursive: true });
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(binary, '\x7fELF');
    fs.chmodSync(binary, 0o755);
    const launcher = `[Desktop Entry]\nType=Application\nName=Focus Thief\nExec=${binary} %U\n`;
    fs.writeFileSync(path.join(systemApps, 'focus-thief.desktop'), launcher);
    fs.writeFileSync(path.join(systemApps, 'focus-thief-alias.desktop'), launcher.replace('Focus Thief', 'Focus Thief Alias'));
    const env = { HOME: home, XDG_DATA_DIRS: path.join(root, 'usr', 'share'), PATH: '' };
    const paths = timeoutPaths(env);
    return { root, env, paths, launchers: new Launchers({ paths, selfCommand: SELF }), systemApps, binary };
}

const settings = appSettings({ delaySeconds: 30, closeAfterSeconds: 600, autoOpen: false, message: 'Is this what you meant to do?' });

test('launchers that start the same program are grouped so one delay covers every alias', () => {
    const { env, launchers } = fakeSystem();
    // Flatpak export folders are always searched, so ignore this machine's real apps.
    const ours = [...installedLaunchers(env).values()].filter(launcher => launcher.id.startsWith('focus-thief'));
    const groups = launchers.groupedApps(ours, emptyConfig());
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].members.map(member => member.id).sort(), ['focus-thief-alias.desktop', 'focus-thief.desktop']);
});

test('enabling a delay installs a wrapped user launcher and keeps a backup of the original', () => {
    const { env, paths, launchers, systemApps } = fakeSystem();
    const original = fs.readFileSync(path.join(systemApps, 'focus-thief.desktop'), 'utf8');
    launchers.configureGroup([{ id: 'focus-thief.desktop', file: path.join(systemApps, 'focus-thief.desktop') }], settings);

    const wrapped = fs.readFileSync(path.join(paths.applicationsDir, 'focus-thief.desktop'), 'utf8');
    assert.match(wrapped, /"--timeout-launch=focus-thief.desktop"/);
    const entry = launchers.load().apps['focus-thief.desktop'];
    assert.equal(entry.name, 'Focus Thief');
    assert.equal(entry.delaySeconds, 30);
    assert.equal(entry.closeAfterSeconds, 600);
    assert.equal(fs.readFileSync(entry.backup, 'utf8'), original);
    // The user override now shadows the system launcher.
    assert.equal(installedLaunchers(env).get('focus-thief.desktop').file, path.join(paths.applicationsDir, 'focus-thief.desktop'));
});

test('turning the delay off removes the override, restoring the system launcher', () => {
    const { paths, launchers, systemApps } = fakeSystem();
    const members = [{ id: 'focus-thief.desktop', file: path.join(systemApps, 'focus-thief.desktop') }];
    launchers.configureGroup(members, settings);
    launchers.configureGroup(members, null);
    assert.equal(fs.existsSync(path.join(paths.applicationsDir, 'focus-thief.desktop')), false);
    assert.deepEqual(launchers.load().apps, {});
});

test('a user launcher that existed before is restored exactly', () => {
    const { paths, launchers, systemApps } = fakeSystem();
    fs.mkdirSync(paths.applicationsDir, { recursive: true });
    const local = path.join(paths.applicationsDir, 'focus-thief.desktop');
    const mine = fs.readFileSync(path.join(systemApps, 'focus-thief.desktop'), 'utf8').replace('Name=Focus Thief', 'Name=My Focus Thief');
    fs.writeFileSync(local, mine);
    launchers.configureGroup([{ id: 'focus-thief.desktop', file: local }], settings);
    launchers.configureGroup([{ id: 'focus-thief.desktop', file: local }], null);
    assert.equal(fs.readFileSync(local, 'utf8'), mine);
});

test('a launcher changed by something else is never overwritten', () => {
    const { paths, launchers, systemApps } = fakeSystem();
    const members = [{ id: 'focus-thief.desktop', file: path.join(systemApps, 'focus-thief.desktop') }];
    launchers.configureGroup(members, settings);
    fs.writeFileSync(path.join(paths.applicationsDir, 'focus-thief.desktop'), '[Desktop Entry]\nName=Edited\n');
    assert.throws(() => launchers.configureGroup(members, null), /changed elsewhere/);
});

test('moving Claritard re-points its launchers on the next start', () => {
    const { paths, launchers, systemApps } = fakeSystem();
    launchers.configureGroup([{ id: 'focus-thief.desktop', file: path.join(systemApps, 'focus-thief.desktop') }], settings);
    new Launchers({ paths, selfCommand: ['/home/me/Claritard-2.AppImage'] }).repair();
    assert.match(fs.readFileSync(path.join(paths.applicationsDir, 'focus-thief.desktop'), 'utf8'), /Claritard-2\.AppImage/);
});

test('settings outside the allowed ranges are refused', () => {
    assert.throws(() => appSettings({ delaySeconds: -1 }));
    assert.throws(() => appSettings({ delaySeconds: 10, closeAfterSeconds: 90000 }));
    assert.throws(() => urlSettings({ delaySeconds: 10, closeAfterSeconds: 30 }));
});

test('a Firefox session starts with the first granted URL and later grants share its deadline', () => {
    const { paths } = fakeSystem();
    const firefox = path.join(paths.home, 'Applications', 'firefox-developer-edition', 'firefox');
    fs.mkdirSync(path.dirname(firefox), { recursive: true });
    fs.writeFileSync(firefox, '\x7fELF');
    const rule = urlSettings({ delaySeconds: 30, closeAfterSeconds: 900 });

    const first = grantBrowserRule(paths, 'https://youtube.com/', rule);
    assert.equal(first.created, true);
    const second = grantBrowserRule(paths, 'https://reddit.com/', rule);
    assert.equal(second.created, false);
    assert.equal(second.session.deadline, first.session.deadline);

    const config = { ...emptyConfig(), urls: { 'https://youtube.com/': rule } };
    const response = browserRulesResponse(config, paths);
    assert.deepEqual(response.unlocked, ['https://youtube.com/', 'https://reddit.com/']);
    assert.deepEqual(response.rules, [{ url: 'https://youtube.com/', delay: 30, duration: 900, message: 'Take a breath.' }]);
});

test('once a Firefox session has run out, no URL can be granted until Firefox has closed', () => {
    const { paths } = fakeSystem();
    fs.mkdirSync(paths.stateDir, { recursive: true });
    fs.writeFileSync(paths.browserSessionFile, JSON.stringify({ id: 'x', deadline: Date.now() / 1000 - 1, rules: [], target: {} }));
    assert.throws(() => grantBrowserRule(paths, 'https://youtube.com/', urlSettings({ delaySeconds: 0, closeAfterSeconds: 60 })), /has ended/);
    assert.equal(readSession(paths).id, 'x');
});
