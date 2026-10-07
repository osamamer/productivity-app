import { alpha, Box } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import BookRoundedIcon from '@mui/icons-material/BookRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import HomeWorkRoundedIcon from '@mui/icons-material/HomeWorkRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';
import LocalFloristRoundedIcon from '@mui/icons-material/LocalFloristRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
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

const PROJECT_ICONS = {
    folder: FolderRoundedIcon,
    rocket: RocketLaunchRoundedIcon,
    lightbulb: LightbulbRoundedIcon,
    book: BookRoundedIcon,
    home: HomeWorkRoundedIcon,
    leaf: LocalFloristRoundedIcon,
} as const;

export function projectAccent(theme: Theme, color: ProjectColor | null | undefined): string {
    return theme.palette[PROJECT_PALETTE_KEYS[color ?? 'blue']].main;
}

export function ProjectIconGlyph({ icon, size = 20 }: { icon: ProjectIcon; size?: number }) {
    const Icon = PROJECT_ICONS[icon];
    return <Icon sx={{ fontSize: size }} />;
}

interface ProjectIdentityIconProps {
    color: ProjectColor | null | undefined;
    icon: ProjectIcon | null | undefined;
    size?: number;
}

export function ProjectIdentityIcon({ color, icon, size = 36 }: ProjectIdentityIconProps) {
    return (
        <Box
            aria-hidden="true"
            sx={theme => {
                const accent = projectAccent(theme, color);
                return {
                    width: size,
                    height: size,
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: accent,
                    bgcolor: alpha(accent, 0.12),
                    border: `1px solid ${alpha(accent, 0.22)}`,
                    borderRadius: 2,
                };
            }}
        >
            <ProjectIconGlyph icon={icon ?? 'folder'} size={size * 0.58} />
        </Box>
    );
}
