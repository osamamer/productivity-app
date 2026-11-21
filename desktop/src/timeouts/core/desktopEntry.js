/**
 * Reads and edits freedesktop `.desktop` files without disturbing lines it does not touch, so a
 * rewritten launcher keeps its translations, comments and actions.
 */

const MAIN_GROUP = 'Desktop Entry';
const ACTION_PREFIX = 'Desktop Action ';

function parseDesktopEntry(text) {
    const groups = [{ name: null, lines: [] }];
    for (const line of String(text).split(/\r?\n/)) {
        const header = /^\[([^\]]+)\]\s*$/.exec(line);
        if (header) {
            groups.push({ name: header[1], lines: [] });
            continue;
        }
        const pair = /^([A-Za-z0-9-]+(?:\[[^\]]+\])?)\s*=\s?(.*)$/.exec(line);
        groups[groups.length - 1].lines.push(pair ? { key: pair[1], value: pair[2] } : { raw: line });
    }
    return { groups };
}

function serializeDesktopEntry(entry) {
    const out = [];
    for (const group of entry.groups) {
        if (group.name !== null) out.push(`[${group.name}]`);
        for (const line of group.lines) out.push('raw' in line ? line.raw : `${line.key}=${line.value}`);
    }
    let text = out.join('\n');
    if (!text.endsWith('\n')) text += '\n';
    return text;
}

function findGroup(entry, name) {
    return entry.groups.find(group => group.name === name) ?? null;
}

function groupNames(entry) {
    return entry.groups.filter(group => group.name !== null).map(group => group.name);
}

/** Undoes the key-file escapes (`\s`, `\n`, `\t`, `\r`, `\\`) like GLib's `get_string`. */
function unescapeValue(value) {
    return value.replace(/\\([sntr\\])/g, (_match, code) => ({ s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\' })[code]);
}

function escapeValue(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t')
        .replace(/\r/g, '\\r')
        .replace(/^ /, '\\s');
}

function getString(entry, groupName, key) {
    const line = findGroup(entry, groupName)?.lines.find(candidate => candidate.key === key);
    return line ? unescapeValue(line.value) : null;
}

function getBoolean(entry, groupName, key) {
    return getString(entry, groupName, key)?.trim() === 'true';
}

function setString(entry, groupName, key, value) {
    let group = findGroup(entry, groupName);
    if (!group) {
        group = { name: groupName, lines: [] };
        entry.groups.push(group);
    }
    const escaped = escapeValue(value);
    const line = group.lines.find(candidate => candidate.key === key);
    if (line) {
        line.value = escaped;
        return;
    }
    // Keep new keys above the blank lines that separate groups.
    let index = group.lines.length;
    while (index > 0 && 'raw' in group.lines[index - 1] && !group.lines[index - 1].raw.trim()) index -= 1;
    group.lines.splice(index, 0, { key, value: escaped });
}

/** Drops every line of `groupName` whose key passes `predicate`. */
function removeKeys(entry, groupName, predicate) {
    const group = findGroup(entry, groupName);
    if (group) group.lines = group.lines.filter(line => !('key' in line) || !predicate(line.key));
}

function setBoolean(entry, groupName, key, value) {
    setString(entry, groupName, key, value ? 'true' : 'false');
}

/** Splits an Exec value into words the way a POSIX shell would (like Python's `shlex.split`). */
function splitExec(command) {
    const words = [];
    let current = '';
    let inWord = false;
    let quote = null;
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
        if (quote === "'") {
            if (char === "'") quote = null;
            else current += char;
            continue;
        }
        if (quote === '"') {
            if (char === '"') {
                quote = null;
            } else if (char === '\\' && index + 1 < command.length && '"\\`$\n'.includes(command[index + 1])) {
                current += command[index + 1];
                index += 1;
            } else {
                current += char;
            }
            continue;
        }
        if (/\s/.test(char)) {
            if (inWord) words.push(current);
            current = '';
            inWord = false;
            continue;
        }
        inWord = true;
        if (char === "'" || char === '"') quote = char;
        else if (char === '\\' && index + 1 < command.length) {
            current += command[index + 1];
            index += 1;
        } else current += char;
    }
    if (quote) throw new Error('The launcher command has an unclosed quote.');
    if (inWord) words.push(current);
    return words;
}

/** Quotes one argument for an Exec line, per the Desktop Entry specification. */
function quoteExecArgument(value) {
    return `"${String(value).replace(/[\\"`$]/g, match => `\\${match}`)}"`;
}

/**
 * Expands the field codes of an Exec line into an argv. `%f`/`%u` take the first file or URI,
 * `%F`/`%U` all of them; `%i`, `%c` and `%k` describe the launcher; deprecated codes vanish.
 */
function expandExec(command, { uris = [], name = '', icon = null, file = '' } = {}) {
    const argv = [];
    for (const word of splitExec(command)) {
        if (word === '%F' || word === '%U') {
            argv.push(...uris);
            continue;
        }
        if (word === '%i') {
            if (icon) argv.push('--icon', icon);
            continue;
        }
        let expanded = '';
        for (let index = 0; index < word.length; index += 1) {
            if (word[index] !== '%' || index + 1 >= word.length) {
                expanded += word[index];
                continue;
            }
            const code = word[index + 1];
            index += 1;
            if (code === '%') expanded += '%';
            else if (code === 'f' || code === 'u') expanded += uris[0] ?? '';
            else if (code === 'c') expanded += name;
            else if (code === 'k') expanded += file;
        }
        if (expanded || !/^%[fuck]$/.test(word)) argv.push(expanded);
    }
    return argv;
}

module.exports = {
    MAIN_GROUP,
    ACTION_PREFIX,
    parseDesktopEntry,
    serializeDesktopEntry,
    groupNames,
    getString,
    getBoolean,
    setString,
    setBoolean,
    removeKeys,
    splitExec,
    quoteExecArgument,
    expandExec,
};
