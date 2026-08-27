import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { NoteCategory } from '../../types/Note.ts';

export type NotesFilter = 'all' | 'pinned' | 'uncategorized' | string;

interface NotesSidebarProps {
    categories: NoteCategory[];
    activeFilter: NotesFilter;
    noteCounts: Record<string, number>;
    onFilterChange: (filter: NotesFilter) => void;
    onAddCategory: () => void;
    onEditCategory: (category: NoteCategory) => void;
    onDeleteCategory: (category: NoteCategory) => void;
}

interface SidebarRowProps {
    active: boolean;
    count: number;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    actions?: React.ReactNode;
}

function SidebarRow({ active, count, icon, label, onClick, actions }: SidebarRowProps) {
    return (
        <Box
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') onClick();
            }}
            sx={{
                minHeight: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.25,
                borderRadius: 2,
                cursor: 'pointer',
                color: active ? 'text.primary' : 'text.secondary',
                backgroundColor: active ? 'action.selected' : 'transparent',
                '&:hover': { backgroundColor: 'action.hover' },
                '&:hover .category-actions': { opacity: 1 },
            }}
        >
            <Box sx={{ display: 'flex', color: active ? 'primary.main' : 'text.secondary' }}>{icon}</Box>
            <Typography variant="body2" noWrap sx={{ flex: 1, textAlign: 'left', fontWeight: active ? 650 : 500 }}>
                {label}
            </Typography>
            {actions ?? (
                <Typography variant="caption" color="text.disabled">
                    {count}
                </Typography>
            )}
        </Box>
    );
}

export function NotesSidebar({
    categories,
    activeFilter,
    noteCounts,
    onFilterChange,
    onAddCategory,
    onEditCategory,
    onDeleteCategory,
}: NotesSidebarProps) {
    return (
        <Box
            component="aside"
            sx={{
                width: { xs: '100%', md: 210 },
                flexShrink: 0,
                px: { xs: 1.25, md: 1.5 },
                py: 2,
                borderRight: { md: theme => `1px solid ${theme.palette.divider}` },
                borderBottom: { xs: theme => `1px solid ${theme.palette.divider}`, md: 'none' },
                overflowY: 'auto',
            }}
        >
            <Typography variant="overline" color="text.disabled" sx={{ display: 'block', px: 1.25, mb: 0.5, textAlign: 'left', letterSpacing: '0.12em' }}>
                Library
            </Typography>
            <SidebarRow
                active={activeFilter === 'all'}
                count={noteCounts.all ?? 0}
                icon={<DescriptionOutlinedIcon sx={{ fontSize: 18 }} />}
                label="All notes"
                onClick={() => onFilterChange('all')}
            />
            <SidebarRow
                active={activeFilter === 'pinned'}
                count={noteCounts.pinned ?? 0}
                icon={<PushPinOutlinedIcon sx={{ fontSize: 18 }} />}
                label="Pinned"
                onClick={() => onFilterChange('pinned')}
            />
            <SidebarRow
                active={activeFilter === 'uncategorized'}
                count={noteCounts.uncategorized ?? 0}
                icon={<FolderOutlinedIcon sx={{ fontSize: 18 }} />}
                label="Uncategorized"
                onClick={() => onFilterChange('uncategorized')}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2.5, mb: 0.5, px: 1.25 }}>
                <Typography variant="overline" color="text.disabled" sx={{ flex: 1, textAlign: 'left', letterSpacing: '0.12em' }}>
                    Categories
                </Typography>
                <Tooltip title="New category">
                    <IconButton size="small" onClick={onAddCategory} aria-label="New category">
                        <AddRoundedIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {categories.map(category => (
                <SidebarRow
                    key={category.id}
                    active={activeFilter === category.id}
                    count={noteCounts[category.id] ?? 0}
                    icon={<Box sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: category.color }} />}
                    label={category.name}
                    onClick={() => onFilterChange(category.id)}
                    actions={(
                        <Box className="category-actions" sx={{ display: 'flex', alignItems: 'center', opacity: activeFilter === category.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                            <Typography variant="caption" color="text.disabled" sx={{ mr: 0.25 }}>
                                {noteCounts[category.id] ?? 0}
                            </Typography>
                            <IconButton
                                size="small"
                                aria-label={`Edit ${category.name}`}
                                onClick={event => {
                                    event.stopPropagation();
                                    onEditCategory(category);
                                }}
                                sx={{ p: 0.4 }}
                            >
                                <EditOutlinedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                aria-label={`Delete ${category.name}`}
                                onClick={event => {
                                    event.stopPropagation();
                                    onDeleteCategory(category);
                                }}
                                sx={{ p: 0.4 }}
                            >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Box>
                    )}
                />
            ))}
        </Box>
    );
}
