import type { BackupSnapshot } from './backupDocument';

export function accessBackup(scope: string, value?: BackupSnapshot | null, isCurrent = () => true): Promise<BackupSnapshot | undefined> {
    return new Promise((resolve, reject) => {
        const opening = indexedDB.open('claritard-local-backups', 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore('snapshots');
        opening.onerror = () => reject(opening.error);
        opening.onsuccess = () => {
            const db = opening.result;
            if (!isCurrent()) { db.close(); resolve(undefined); return; }
            const transaction = db.transaction('snapshots', value === undefined ? 'readonly' : 'readwrite');
            const store = transaction.objectStore('snapshots');
            const request = value === undefined ? store.get(scope)
                : value === null ? store.delete(scope) : store.put(value, scope);
            transaction.oncomplete = () => { db.close(); resolve(value === undefined ? request.result : value ?? undefined); };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
            transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
    });
}
