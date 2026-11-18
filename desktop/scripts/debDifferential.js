#!/usr/bin/env node
/*
 * Makes the .deb that electron-builder produced cheap to update from, so installed copies
 * download only the parts that changed (see src/debUpdater.js):
 *
 *   1. Rewrites data.tar so the same files give the same bytes in every build: entries sorted
 *      by name and every modification time set to one fixed date.
 *   2. Compresses it with `zstd --rsyncable`, which restarts compression at points chosen by the
 *      content itself, so an unchanged stretch of files compresses to unchanged bytes. The default
 *      xz stream changes completely after the first changed byte.
 *   3. Writes <deb>.blockmap (the block checksums the updater compares) and fixes the .deb's
 *      size and sha512 in latest-linux.yml.
 *
 * Usage: node scripts/debDifferential.js dist/claritard-desktop_X_amd64.deb dist/latest-linux.yml
 *
 * Needs xz and zstd on PATH. The resulting data.tar.zst needs dpkg 1.21.18 or newer (Debian 12,
 * Ubuntu 22.04 and later).
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const BLOCK = 512;
// 2020-01-01: any fixed date works; dpkg gives installed files this modification time.
const FIXED_MTIME = 1577836800;
const MAX_BUFFER = 4 * 1024 * 1024 * 1024;
// --rsyncable restarts compression at content-chosen points spaced in proportion to the window,
// so a smaller window means a smaller re-download per change. Measured on two builds a
// one-line change apart: the default -19 window gave 242 MB and a 12.7 MB update; a 2 MB window
// (wlog=21) gives 253 MB and a 2 MB update.
const ZSTD_ARGS = ['-19', '--zstd=wlog=21', '-T0', '--rsyncable', '-q', '-c'];

function readAr(buffer) {
    if (buffer.toString('latin1', 0, 8) !== '!<arch>\n') throw new Error('Not an ar archive');
    const members = [];
    let offset = 8;
    while (offset < buffer.length) {
        const header = buffer.toString('latin1', offset, offset + 60);
        const name = header.slice(0, 16).trim().replace(/\/$/, '');
        const size = Number.parseInt(header.slice(48, 58).trim(), 10);
        const start = offset + 60;
        members.push({ name, data: buffer.subarray(start, start + size) });
        offset = start + size + (size % 2);
    }
    return members;
}

function writeAr(members, mtime = FIXED_MTIME) {
    const parts = [Buffer.from('!<arch>\n', 'latin1')];
    for (const { name, data } of members) {
        const header = name.padEnd(16) + String(mtime).padEnd(12) + '0'.padEnd(6) + '0'.padEnd(6)
            + '100644'.padEnd(8) + String(data.length).padEnd(10) + '`\n';
        parts.push(Buffer.from(header, 'latin1'), data);
        if (data.length % 2) parts.push(Buffer.from('\n', 'latin1'));
    }
    return Buffer.concat(parts);
}

const field = (block, start, length) => block.toString('latin1', start, start + length).replace(/\0.*$/s, '');
const octal = (block, start, length) => Number.parseInt(field(block, start, length).trim() || '0', 8);

function setMtime(block, mtime) {
    block.write(mtime.toString(8).padStart(11, '0') + '\0', 136, 12, 'latin1');
    block.fill(0x20, 148, 156);
    let sum = 0;
    for (const byte of block) sum += byte;
    block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'latin1');
}

const paxPath = data => /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString('utf8'))?.[1];

/**
 * Splits a tar archive into entries. A GNU long-name ('L'/'K') or pax ('x') header belongs to the
 * entry after it, so it stays with that entry. Returns [{ name, type, blocks: Buffer[] }].
 */
function readTarEntries(buffer) {
    const entries = [];
    let pending = [];
    let longName = null;
    let offset = 0;
    while (offset + BLOCK <= buffer.length) {
        const header = buffer.subarray(offset, offset + BLOCK);
        if (header.every(byte => byte === 0)) break;
        const size = octal(header, 124, 12);
        const type = field(header, 156, 1) || '0';
        const end = offset + BLOCK + Math.ceil(size / BLOCK) * BLOCK;
        const blocks = [Buffer.from(buffer.subarray(offset, end))];
        const body = buffer.subarray(offset + BLOCK, offset + BLOCK + size);
        offset = end;
        if (type === 'L') longName = field(body, 0, body.length);
        if (type === 'x') longName = paxPath(body) ?? longName;
        if (type === 'L' || type === 'K' || type === 'x') {
            pending.push(...blocks);
            continue;
        }
        const prefix = field(header, 257, 6) === 'ustar' ? field(header, 345, 155) : '';
        const name = longName ?? (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100));
        entries.push({ name, type, blocks: [...pending, ...blocks] });
        pending = [];
        longName = null;
    }
    return entries;
}

/**
 * The same archive with entries sorted by name and every header's modification time fixed, so
 * identical files give identical bytes from build to build. A directory sorts before what is in
 * it because its name is a prefix of theirs.
 */
function normalizeTar(buffer, mtime = FIXED_MTIME) {
    const entries = readTarEntries(buffer);
    if (entries.some(entry => entry.type === '1')) {
        throw new Error('Hard links in data.tar would break when reordered; leave the .deb as built');
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const archive = Buffer.concat([...entries.flatMap(entry => entry.blocks), Buffer.alloc(BLOCK * 2)]);
    fixHeaderMtimes(archive, mtime);
    return archive;
}

function fixHeaderMtimes(archive, mtime) {
    let offset = 0;
    while (offset + BLOCK <= archive.length) {
        const header = archive.subarray(offset, offset + BLOCK);
        if (header.every(byte => byte === 0)) break;
        const size = octal(header, 124, 12);
        setMtime(header, mtime);
        offset += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    }
}

/** latest-linux.yml with the size and sha512 of `fileName` replaced. */
function updateLatestYml(text, fileName, { sha512, size }) {
    const lines = text.split('\n');
    const start = lines.findIndex(line => line.trim() === `- url: ${fileName}`);
    if (start < 0) throw new Error(`${fileName} is not listed in latest-linux.yml`);
    for (let i = start + 1; i < lines.length && lines[i].startsWith('    '); i++) {
        lines[i] = lines[i]
            .replace(/^(\s+sha512: ).*$/, `$1${sha512}`)
            .replace(/^(\s+size: ).*$/, `$1${size}`);
    }
    return lines.join('\n');
}

function decompress(name, data) {
    if (name.endsWith('.xz')) return execFileSync('xz', ['-dc'], { input: data, maxBuffer: MAX_BUFFER });
    if (name.endsWith('.zst')) return execFileSync('zstd', ['-dcq'], { input: data, maxBuffer: MAX_BUFFER });
    if (name.endsWith('.gz')) return execFileSync('gzip', ['-dc'], { input: data, maxBuffer: MAX_BUFFER });
    if (name === 'data.tar') return data;
    throw new Error(`Unsupported member ${name}`);
}

async function main(debPath, ymlPath) {
    const members = readAr(fs.readFileSync(debPath));
    const data = members.find(member => member.name.startsWith('data.tar'));
    if (!data) throw new Error(`${debPath} has no data.tar`);
    const tar = normalizeTar(decompress(data.name, data.data));
    const compressed = execFileSync('zstd', ZSTD_ARGS, { input: tar, maxBuffer: MAX_BUFFER });
    const repacked = members.map(member => (member === data ? { name: 'data.tar.zst', data: compressed } : member));
    fs.writeFileSync(debPath, writeAr(repacked));

    const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
    const info = await buildBlockMap(debPath, 'gzip', `${debPath}.blockmap`);
    fs.writeFileSync(ymlPath, updateLatestYml(fs.readFileSync(ymlPath, 'utf8'), path.basename(debPath), info));
    console.log(`${path.basename(debPath)}: ${info.size} bytes, blockmap written`);
}

if (require.main === module) {
    const [debPath, ymlPath] = process.argv.slice(2);
    if (!debPath || !ymlPath) {
        console.error('Usage: debDifferential.js <file.deb> <latest-linux.yml>');
        process.exit(2);
    }
    main(debPath, ymlPath).catch(error => {
        console.error(`Could not prepare the .deb for differential updates: ${error.message}`, error);
        process.exit(1);
    });
}

module.exports = { readAr, writeAr, readTarEntries, normalizeTar, updateLatestYml };
