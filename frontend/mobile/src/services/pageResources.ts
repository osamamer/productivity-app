import { loadPage } from '@/lib/pageCache';
import { api } from './api';

export async function loadMentalThreads() {
  const [threads, summary] = await Promise.all([api.mentalThreads.all(true), api.mentalThreads.summary()]);
  return { threads, summary };
}

export function warmMentalPages(): void {
  const reads = [
    loadPage('mental-threads', loadMentalThreads),
    loadPage('mental-state', () => api.mentalState.history()),
  ];
  void Promise.allSettled(reads).then(results => {
    results.forEach(result => {
      if (result.status === 'rejected') console.error('Could not warm mental page:', result.reason);
    });
  });
}
