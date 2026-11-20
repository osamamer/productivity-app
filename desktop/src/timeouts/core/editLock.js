const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const WAIT_MS = 10_000;
const UNLOCKED_MS = 15 * 60_000;
const MIN_PASSWORD_LENGTH = 8;

function hash(password, salt) {
    return crypto.scryptSync(password, Buffer.from(salt, 'base64'), 32).toString('base64');
}

/**
 * Boundaries can only be changed after entering the password and then waiting ten seconds, so a
 * limit is never loosened on impulse. The unlock then lasts fifteen minutes or until `lock()`.
 *
 * Limitation: this is friction, not security. Anyone with this account can edit timeouts.json
 * directly, or delete password.json to set a new password.
 */
class EditLock {
    constructor({ file, now = () => Date.now() }) {
        this.file = file;
        this.now = now;
        this.readyAt = 0;
        this.unlockedUntil = 0;
    }

    stored() {
        try {
            return JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch (error) {
            if (error.code !== 'ENOENT') console.error('Could not read the Boundaries password:', error);
            return null;
        }
    }

    get hasPassword() {
        return this.stored() !== null;
    }

    get unlocked() {
        const now = this.now();
        return this.hasPassword && this.readyAt <= now && now < this.unlockedUntil;
    }

    /** What the page shows: epoch ms the wait ends and the unlock lapses (0 while locked). */
    status() {
        return { hasPassword: this.hasPassword, readyAt: this.readyAt, unlockedUntil: this.unlockedUntil, waitMs: WAIT_MS };
    }

    /** Sets the first password (which unlocks at once), or a new one while unlocked. */
    setPassword(password) {
        if (this.hasPassword && !this.unlocked) throw new Error('Unlock editing before changing the password.');
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`The password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        const salt = crypto.randomBytes(16).toString('base64');
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, `${JSON.stringify({ salt, hash: hash(password, salt) })}\n`, { mode: 0o600 });
        if (this.readyAt === 0 || this.unlockedUntil <= this.now()) {
            this.readyAt = this.now();
            this.unlockedUntil = this.readyAt + UNLOCKED_MS;
        }
        return this.status();
    }

    /** Checks the password and starts the wait; edits work once it ends. */
    unlock(password) {
        const stored = this.stored();
        if (!stored) throw new Error('Set a password first.');
        const actual = Buffer.from(hash(String(password ?? ''), stored.salt), 'base64');
        const expected = Buffer.from(stored.hash, 'base64');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
            throw new Error('Incorrect password.');
        }
        this.readyAt = this.now() + WAIT_MS;
        this.unlockedUntil = this.readyAt + UNLOCKED_MS;
        return this.status();
    }

    lock() {
        this.readyAt = 0;
        this.unlockedUntil = 0;
        return this.status();
    }

    assertUnlocked() {
        if (!this.hasPassword) throw new Error('Set a Boundaries password first.');
        if (this.now() < this.readyAt) throw new Error('Wait for the countdown to finish before changing boundaries.');
        if (!this.unlocked) throw new Error('Enter your password to change boundaries.');
    }
}

module.exports = { EditLock, WAIT_MS, UNLOCKED_MS, MIN_PASSWORD_LENGTH };
