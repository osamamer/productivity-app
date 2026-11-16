const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 500;
const SHUTDOWN_GRACE_MS = 20_000;
const ORPHAN_SHUTDOWN_MS = 15_000;

function resolveJava(resourcesDir) {
    const bundled = path.join(resourcesDir, 'jre', 'bin', 'java');
    if (fs.existsSync(bundled)) return bundled;
    if (process.env.JAVA_HOME) return path.join(process.env.JAVA_HOME, 'bin', 'java');
    return 'java';
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function isRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

/**
 * If the app was killed without a clean shutdown, its embedded PostgreSQL can outlive it and
 * keep the data directory locked. Stop that server (and only a server for this directory)
 * before starting a new backend.
 */
async function stopOrphanedPostgres(databaseDir) {
    let pid;
    try {
        pid = Number.parseInt(fs.readFileSync(path.join(databaseDir, 'postmaster.pid'), 'utf8').split('\n')[0], 10);
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Could not inspect the local database lock file:', error);
        return;
    }
    if (!Number.isInteger(pid) || !isRunning(pid)) return;
    let commandLine = '';
    try {
        commandLine = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    } catch (error) {
        console.error('Could not inspect the process holding the local database lock:', error);
        return;
    }
    if (!commandLine.includes('postgres') || !commandLine.includes(databaseDir)) return;

    console.warn(`Stopping a leftover local database server (pid ${pid})`);
    process.kill(pid, 'SIGINT');
    const deadline = Date.now() + ORPHAN_SHUTDOWN_MS;
    while (isRunning(pid) && Date.now() < deadline) await delay(250);
}

async function isHealthy(origin) {
    try {
        const response = await fetch(`${origin}/actuator/health`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Owns the bundled Spring Boot backend for local mode: one JVM per app run, bound to loopback,
 * with its own embedded PostgreSQL under `dataDir`.
 */
class LocalBackend {
    constructor({ resourcesDir, dataDir, logDir, port }) {
        this.resourcesDir = resourcesDir;
        this.dataDir = dataDir;
        this.logDir = logDir;
        this.port = port;
        this.origin = `http://127.0.0.1:${port}`;
        this.logFile = path.join(logDir, 'backend.log');
        this.child = null;
    }

    async start(authSecret) {
        if (await isHealthy(this.origin)) {
            throw new Error(`Port ${this.port} is already used by another program, so the local backend cannot start.`);
        }
        fs.mkdirSync(this.dataDir, { recursive: true });
        fs.mkdirSync(this.logDir, { recursive: true });
        await stopOrphanedPostgres(path.join(this.dataDir, 'postgres'));

        const log = fs.openSync(this.logFile, 'w');
        const java = resolveJava(this.resourcesDir);
        this.child = spawn(java, [
            '-Xms64m',
            '-XX:+UseSerialGC',
            '-jar', path.join(this.resourcesDir, 'backend.jar'),
            '--spring.profiles.active=desktop',
        ], {
            cwd: this.dataDir,
            stdio: ['ignore', log, log],
            env: {
                ...process.env,
                DESKTOP_PORT: String(this.port),
                DESKTOP_DATA_DIR: this.dataDir,
                DESKTOP_FRONTEND_DIR: path.join(this.resourcesDir, 'frontend'),
                DESKTOP_AUTH_SECRET: authSecret.toString('base64'),
            },
        });
        fs.closeSync(log);

        const exited = new Promise((_, reject) => {
            this.child.once('error', error => reject(new Error(`Could not run Java (${java}): ${error.message}`)));
            this.child.once('exit', code => reject(new Error(`The local backend stopped during startup (exit code ${code}).`)));
        });
        await Promise.race([this.waitForHealth(), exited]);
    }

    async waitForHealth() {
        const deadline = Date.now() + HEALTH_TIMEOUT_MS;
        while (Date.now() < deadline) {
            if (await isHealthy(this.origin)) return;
            await delay(HEALTH_POLL_MS);
        }
        throw new Error('The local backend did not become ready in time.');
    }

    /** Asks Spring Boot to shut down gracefully so it can stop PostgreSQL cleanly. */
    stop() {
        const child = this.child;
        this.child = null;
        if (!child || child.exitCode !== null) return Promise.resolve();
        return new Promise(resolve => {
            const forceKill = setTimeout(() => {
                console.error('The local backend did not stop in time; killing it');
                child.kill('SIGKILL');
            }, SHUTDOWN_GRACE_MS);
            child.once('exit', () => {
                clearTimeout(forceKill);
                resolve();
            });
            child.kill('SIGTERM');
        });
    }
}

module.exports = { LocalBackend, resolveJava };
