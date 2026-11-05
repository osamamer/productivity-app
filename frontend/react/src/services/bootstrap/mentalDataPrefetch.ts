import { mentalThreadService } from '../api/mentalThreadService';
import { mentalStateService } from '../api/mentalStateService';
import { meditationService } from '../api/meditationService';
import { statService } from '../api/statService';
import { sideNavSnapshotCache } from '../cache/sideNavSnapshotCache';
import { getAuthCacheScope } from '../utils/authHeaders';

function localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function warmMeditationStats(): Promise<void> {
    const definitions = await statService.getDefinitions();
    const meditationDefinitions = definitions.filter(definition =>
        definition.systemKey === 'meditated' || definition.systemKey === 'meditation_minutes');
    const now = new Date();
    const from = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = localDate(now);
    await Promise.all(meditationDefinitions.flatMap(definition => [
        statService.getSummary(definition.id, from, to),
        statService.getEntries(definition.id, from, to),
    ]));
}

export function warmMentalData(): void {
    const scope = getAuthCacheScope();
    const requests = [
        mentalThreadService.getThreads(true),
        mentalThreadService.getSummary(),
        meditationService.getActiveSession(),
        mentalStateService.getHistory(40).then(history => {
            if (scope !== getAuthCacheScope() || mentalStateService.getCachedHistory(40) !== history) return;
            const latest = history[0];
            const age = latest ? Date.now() - Date.parse(latest.recordedAt) : Number.POSITIVE_INFINITY;
            sideNavSnapshotCache.updateMentalState(age >= 0 && age <= 60 * 60 * 1000 ? latest.state : null);
        }),
        warmMeditationStats(),
    ];
    void Promise.allSettled(requests).then(results => {
        results.forEach(result => {
            if (result.status === 'rejected') console.error('Could not warm mental page data:', result.reason);
        });
    });
}
