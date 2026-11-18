const fs = require('node:fs');
const path = require('node:path');
const { mergeSegments, mergeIntervals, clipToRange, splitAtLocalMidnight, dayKey, dayKeysBetween } = require('./segments');

/**
 * Screen time on disk: one JSON-lines file per local date, holding app segments
 * (`{"k":"s","s":…,"e":…,"a":"firefox","t":"title"}`) and spans when tracking was running
 * (`{"k":"t","s":…,"e":…}`). Appending keeps writes cheap and a torn last line only loses
 * that line.
 *
 * Limitation: only closed pieces are written, so a hard crash loses the open segment, which
 * is at most one checkpoint interval long.
 */
class UsageStore {
    constructor(daysDir) {
        this.daysDir = daysDir;
    }

    fileFor(key) {
        return path.join(this.daysDir, `${key}.jsonl`);
    }

    appendRecords(item, toRecord) {
        fs.mkdirSync(this.daysDir, { recursive: true });
        for (const piece of splitAtLocalMidnight(item)) {
            fs.appendFileSync(this.fileFor(dayKey(piece.start)), `${JSON.stringify(toRecord(piece))}\n`);
        }
    }

    appendSegment(segment) {
        this.appendRecords(segment, piece => ({ k: 's', s: piece.start, e: piece.end, a: piece.appId, t: piece.title }));
    }

    appendTracked(interval) {
        this.appendRecords(interval, piece => ({ k: 't', s: piece.start, e: piece.end }));
    }

    readRecords(key) {
        let text;
        try {
            text = fs.readFileSync(this.fileFor(key), 'utf8');
        } catch (error) {
            if (error.code !== 'ENOENT') console.error(`Could not read screen time for ${key}: ${error.message}`, error);
            return [];
        }
        const records = [];
        let skipped = 0;
        for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            try {
                const record = JSON.parse(line);
                if (Number.isFinite(record.s) && Number.isFinite(record.e) && record.e > record.s) records.push(record);
                else skipped += 1;
            } catch {
                skipped += 1;
            }
        }
        if (skipped) console.warn(`Skipped ${skipped} unreadable screen-time line(s) in ${key}.jsonl`);
        return records;
    }

    /** Merged segments and tracked spans within [from, to). */
    readRange(from, to) {
        const segments = [];
        const tracked = [];
        for (const key of dayKeysBetween(from, to)) {
            for (const record of this.readRecords(key)) {
                if (record.k === 's' && typeof record.a === 'string') {
                    segments.push({ start: record.s, end: record.e, appId: record.a, title: typeof record.t === 'string' ? record.t : null });
                } else if (record.k === 't') {
                    tracked.push({ start: record.s, end: record.e });
                }
            }
        }
        return {
            segments: mergeSegments(clipToRange(segments, from, to)),
            tracked: mergeIntervals(clipToRange(tracked, from, to)),
        };
    }
}

module.exports = { UsageStore };
