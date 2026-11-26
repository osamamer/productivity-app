export function pageInvalidationPrefixes(path: string): readonly string[] {
  const feature = path.split('/')[3]?.split('?')[0];
  switch (feature) {
    case 'notes': return ['notes', 'note:'];
    case 'note-categories': return ['notes', 'note:', 'note-categories'];
    case 'events': return ['events'];
    case 'calendars': return ['calendars', 'events'];
    case 'calendar-sources': return ['calendar-sources', 'calendars', 'events'];
    case 'mental-threads': return ['mental-threads'];
    case 'mental-state': return ['mental-state'];
    case 'day': return ['day:'];
    case 'users': return ['preferences'];
    case 'stats': return ['stats:', 'stat:', 'stat-definitions'];
    case 'tasks':
    case 'task-series':
    case 'task-groups':
    case 'session': return ['stats:', 'stat:', 'mental-threads'];
    case 'meditation': return ['stats:', 'stat:'];
    case 'notifications': return [];
    default: return [''];
  }
}
