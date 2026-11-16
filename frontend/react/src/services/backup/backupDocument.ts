export interface BackupSnapshot {
    version: 1;
    capturedAt: string;
    data: Record<string, Record<string, unknown>[]>;
}

function escape(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]!);
}

function label(value: string): string {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function backupDocument(snapshot: BackupSnapshot): string {
    const sections = Object.entries(snapshot.data).map(([name, rows]) => {
        if (!rows.length) return '';
        const cards = rows.map(row => `<article>${Object.entries(row)
            .filter(([, value]) => value !== null && value !== '')
            .map(([key, value]) => `<div><dt>${escape(label(key))}</dt><dd>${escape(
                typeof value === 'object' ? JSON.stringify(value) : value,
            )}</dd></div>`).join('')}</article>`).join('');
        return `<details><summary>${escape(label(name))} (${rows.length})</summary>${cards}</details>`;
    }).join('');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>Claritard local backup</title><style>
body{font:16px/1.5 system-ui,sans-serif;max-width:70rem;margin:2rem auto;padding:0 1rem;color:#20242b;background:#fafafa}
h1{font-size:1.7rem}summary{cursor:pointer;font-weight:600;padding:1rem}details{border:1px solid #ddd;border-radius:12px;margin:1rem 0}
article{margin:1rem;padding:1rem;background:white;border-radius:8px;border:1px solid #eee}article div{display:grid;grid-template-columns:minmax(8rem,1fr) 3fr;gap:1rem;padding:.25rem 0}
dt{font-weight:600;text-transform:capitalize}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p{color:#555}
@media(prefers-color-scheme:dark){body{background:#181a20;color:#eee}article{background:#24262e;border-color:#444}details{border-color:#444}p{color:#bbb}}
</style><h1>Local backup</h1><p>View-only copy from ${escape(new Date(snapshot.capturedAt).toLocaleString())}.
Cloud data remains authoritative. This copy cannot change your account.</p>
<p>Includes saved records, secret statistics, and preferences. Uploaded audio files, calendar subscription credentials, and sign-in information are excluded.</p>${sections}</html>`;
}
