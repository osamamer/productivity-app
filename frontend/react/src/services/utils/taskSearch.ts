import { Task } from '../../types/Task';

/**
 * Converts user-entered text and task fields to the same searchable form.
 * Keeping punctuation as word boundaries makes queries such as "project, urgent"
 * behave like their natural-language equivalent.
 */
export function normalizeTaskSearchText(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

type SearchableTask = Pick<Task, 'name' | 'description' | 'tag'>;

export function createTaskSearchMatcher(query: string): (task: SearchableTask) => boolean {
    const terms = normalizeTaskSearchText(query).split(' ').filter(Boolean);

    return (task: SearchableTask) => {
        if (terms.length === 0) return true;

        const searchableText = normalizeTaskSearchText(
            [task.name, task.description, task.tag].filter(Boolean).join(' '),
        );
        return terms.every(term => searchableText.includes(term));
    };
}

export function taskMatchesSearch(task: SearchableTask, query: string): boolean {
    return createTaskSearchMatcher(query)(task);
}
