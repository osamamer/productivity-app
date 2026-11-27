import { format } from 'date-fns';
import type { WhenDraft } from '../../../../../shared/whenDraft.ts';

export {
    describeChange,
    emptyWhenDraft,
    REMINDER_PRESETS,
    reminderLabel,
    scheduleOf,
    seriesStartFor,
    whenDraftFromSchedule,
    type ChangeScope,
    type WhenChange,
    type WhenDraft,
} from '../../../../../shared/whenDraft.ts';

/** "Fri 28 Nov, 09:00", with the year when it is not this year. */
export function scheduleLabel(draft: WhenDraft, now = new Date()): string {
    if (!draft.date) return 'No date';
    const date = new Date(`${draft.date}T12:00:00`);
    const dayFormat = date.getFullYear() === now.getFullYear() ? 'EEE d MMM' : 'EEE d MMM yyyy';
    return `${format(date, dayFormat)}, ${draft.time}`;
}
