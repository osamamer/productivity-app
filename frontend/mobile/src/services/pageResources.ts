import { invalidatePages, loadPage, readPage } from '@/lib/pageCache';
import type { MeditationSession } from '@/types/models';
import { api } from './api';
import { loadMeditationStats, meditationStatsRange } from './meditationResources';
import { loadMeditationSettings, meditationSettingsStorageKey } from './meditationSettings';

export async function loadMentalThreads() {
  const [threads, summary] = await Promise.all([api.mentalThreads.all(true), api.mentalThreads.summary()]);
  return { threads, summary };
}

export async function loadActiveMeditationSession() {
  const previous = readPage<MeditationSession | undefined>('meditation-active');
  const session = await api.meditation.active();
  if (previous?.value && previous.value.id !== session?.id) {
    invalidatePages(['stats:meditation:']);
  }
  return session;
}

export function warmMentalPages(userId?: string): void {
  const range = meditationStatsRange();
  const reads = [
    loadPage('mental-threads', loadMentalThreads),
    loadPage('mental-state', () => api.mentalState.history()),
    loadPage('meditation-active', loadActiveMeditationSession, true),
    loadPage(range.key, () => loadMeditationStats(range.from, range.to, api.stats)),
    loadMeditationSettings(meditationSettingsStorageKey(userId)),
  ];
  void Promise.allSettled(reads).then(results => {
    results.forEach(result => {
      if (result.status === 'rejected') console.error('Could not warm mental page:', result.reason);
    });
  });
}
