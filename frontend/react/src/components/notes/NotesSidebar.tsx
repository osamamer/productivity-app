import { useState } from 'react';
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
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
    onCreateNote: (category: NoteCategory) => void;
    onEditCategory: (category: NoteCategory) => void;
    onDeleteCategory: (category: NoteCategory) => void;
}

interface SidebarRowProps {
    active: boolean;
    count: number;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    actions?: React.ReactNode;
}

function SidebarRow({ active, count, icon, label, onClick, onContextMenu, actions }: SidebarRowProps) {
    return (
        <Box
            role="button"
            tabIndex={0}
            onClick={onClick}
            onContextMenu={onContextMenu}
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
    onCreateNote,
    onEditCategory,
    onDeleteCategory,
}: NotesSidebarProps) {
    const [categoryContextMenu, setCategoryContextMenu] = useState<{
        category: NoteCategory;
        mouseX: number;
        mouseY: number;
    } | null>(null);

    function handleCategoryContextMenu(event: React.MouseEvent, category: NoteCategory) {
        event.preventDefault();
        event.stopPropagation();
        setCategoryContextMenu({ category, mouseX: event.clientX + 2, mouseY: event.clientY + 2 });
    }

    function closeCategoryContextMenu() {
        setCategoryContextMenu(null);
    }

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
                    onContextMenu={event => handleCategoryContextMenu(event, category)}
                    actions={(
                        <Box className="category-actions" sx={{ display: 'flex', alignItems: 'center', opacity: activeFilter === category.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                            <Typography variant="caption" color="text.disabled" sx={{ mr: 0.25 }}>
                                {noteCounts[category.id] ?? 0}
                            </Typography>
                            <IconButton
                                size="small"
                                aria-label={`New note in ${category.name}`}
                                onClick={event => {
                                    event.stopPropagation();
                                    onFilterChange(category.id);
                                    onCreateNote(category);
                                }}
                                sx={{ p: 0.4 }}
                            >
                                <AddRoundedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                    )}
                />
            ))}

            <Menu
                open={Boolean(categoryContextMenu)}
                onClose={closeCategoryContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={categoryContextMenu ? { top: categoryContextMenu.mouseY, left: categoryContextMenu.mouseX } : undefined}
                slotProps={{ paper: { sx: { minWidth: 160, borderRadius: 2.5 } } }}
            >
                <MenuItem
                    onClick={() => {
                        if (categoryContextMenu) onEditCategory(categoryContextMenu.category);
                        closeCategoryContextMenu();
                    }}
                >
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit category</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (categoryContextMenu) onDeleteCategory(categoryContextMenu.category);
                        closeCategoryContextMenu();
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Delete category</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
}
