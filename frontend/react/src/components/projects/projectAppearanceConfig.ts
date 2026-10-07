import type { Theme } from '@mui/material/styles';
import type { ProjectColor, ProjectIcon } from '../../types/Project';

export const PROJECT_COLOR_OPTIONS: Array<{ value: ProjectColor; label: string }> = [
    { value: 'blue', label: 'Blue' },
    { value: 'violet', label: 'Violet' },
    { value: 'teal', label: 'Teal' },
    { value: 'amber', label: 'Amber' },
    { value: 'rose', label: 'Rose' },
];

export const PROJECT_ICON_OPTIONS: Array<{ value: ProjectIcon; label: string }> = [
    { value: 'folder', label: 'Folder' },
    { value: 'rocket', label: 'Rocket' },
    { value: 'lightbulb', label: 'Idea' },
    { value: 'book', label: 'Book' },
    { value: 'home', label: 'Home' },
    { value: 'leaf', label: 'Personal' },
];

const PROJECT_PALETTE_KEYS = {
    blue: 'primary',
    violet: 'secondary',
    teal: 'success',
    amber: 'warning',
    rose: 'error',
} as const;

export function projectAccent(theme: Theme, color: ProjectColor | null | undefined): string {
    return theme.palette[PROJECT_PALETTE_KEYS[color ?? 'blue']].main;
}
