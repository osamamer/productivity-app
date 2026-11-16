import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { accessBackup } from './backupStore';
import { backupDocument, type BackupSnapshot } from './backupDocument';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const DAY = 86_400_000;
const listeners = new Set<() => void>();
const pending = new Map<string, { revision: string; operation: Promise<void> }>();
let generation = 0;
export const subscribeBackups = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const backupRevision = () => generation;
function changed() { generation++; listeners.forEach(listener => listener()); }
function scope() { return `${API_BASE_URL}:${getAuthCacheScope()}`; }
function preferenceKey(key: string) { return `claritard:local-backup:${key}`; }
function readPreference(key: string): string | null {
    try { return localStorage.getItem(preferenceKey(key)); }
    catch (error) {
        console.error('Could not read local backup preference:', error);
        return null;
    }
}
export function backupsEnabled() { return readPreference(scope()) !== null; }
export function readBackup() { return backupsEnabled() ? accessBackup(scope()) : Promise.resolve(undefined); }

export async function setBackupsEnabled(enabled: boolean): Promise<void> {
    if (getAuthCacheScope() === 'anonymous') throw new Error('Sign in to enable backups.');
    const key = scope();
    if (enabled) localStorage.setItem(preferenceKey(key), crypto.randomUUID());
    else localStorage.removeItem(preferenceKey(key));
    changed();
    if (!enabled) {
        await accessBackup(key, null, () => readPreference(key) === null);
        changed();
    }
}

export function refreshBackup(force = false): Promise<void> {
    const key = scope();
    const revision = readPreference(key);
    if (!revision || getAuthCacheScope() === 'anonymous') return Promise.resolve();
    const existing = pending.get(key);
    if (existing) {
        if (existing.revision === revision) return existing.operation;
        return existing.operation.catch(error => console.error('Previous backup refresh failed:', error))
            .then(() => { if (scope() === key) return refreshBackup(force); });
    }
    const headers = getAuthHeaders();
    const operation = (async () => {
        const previous = await accessBackup(key);
        if (!force && previous && Date.now() - Date.parse(previous.capturedAt) < DAY) return;
        const response = await fetch(`${API_BASE_URL}/api/v1/users/me/backup`, {
            headers, cache: 'no-store', signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) throw new Error(`Backup request failed (${response.status})`);
        const snapshot = await response.json() as BackupSnapshot;
        if (snapshot.version !== 1 || !Number.isFinite(Date.parse(snapshot.capturedAt))
            || !snapshot.data || !Object.values(snapshot.data).every(Array.isArray)) {
            throw new Error('Invalid backup response');
        }
        if (scope() !== key || readPreference(key) !== revision) return;
        await accessBackup(key, snapshot, () => scope() === key && readPreference(key) === revision);
        changed();
    })().finally(() => { pending.delete(key); });
    pending.set(key, { revision, operation });
    return operation;
}

export function startDailyBackups(): () => void {
    const refresh = () => { void refreshBackup().catch(error => console.error('Could not refresh local backup:', error)); };
    refresh();
    const timer = window.setInterval(refresh, 60 * 60 * 1000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', changed);
    return () => {
        clearInterval(timer);
        window.removeEventListener('online', refresh);
        window.removeEventListener('focus', refresh);
        window.removeEventListener('storage', changed);
    };
}

export async function openBackup(download = false): Promise<void> {
    const snapshot = await readBackup();
    if (!snapshot) throw new Error('No backup available');
    const html = backupDocument(snapshot);
    if (download) {
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `claritard-backup-${snapshot.capturedAt.slice(0, 10)}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }
    // A separate document cannot trigger mutations, timers, notification acknowledgements,
    // or reconciliation through the normal application providers.
    const viewer = document.createElement('div');
    viewer.style.cssText = 'position:fixed;inset:0;z-index:10000;background:Canvas;display:flex;flex-direction:column';
    const close = document.createElement('button');
    close.textContent = 'Back to app';
    close.style.cssText = 'padding:12px;font:inherit;cursor:pointer';
    const frame = document.createElement('iframe');
    frame.title = 'View-only local backup';
    frame.setAttribute('sandbox', '');
    frame.srcdoc = html;
    frame.style.cssText = 'flex:1;border:0;width:100%';
    const root = document.getElementById('root');
    if (root) root.inert = true;
    close.onclick = () => { viewer.remove(); if (root) root.inert = false; };
    viewer.append(close, frame);
    document.body.append(viewer);
    close.focus();
}
