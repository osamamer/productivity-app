import { useEffect, useRef, useState } from 'react';
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    Fade, List, ListItem, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Popover,
    Stack, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import ViewDayIcon from '@mui/icons-material/ViewDay';
import { alpha, useTheme } from '@mui/material/styles';
import { DayTemplate } from '../../types/DayTemplate';

export const DAY_TEMPLATE_DRAG_TYPE = 'application/x-claritard-day-template';

type Props = {
    templates: DayTemplate[];
    applyingTemplateId?: string | null;
    error?: string | null;
    onCreate: () => void;
    onEdit: (template: DayTemplate) => void;
    onDelete: (templateId: string) => Promise<void>;
    onDragStart: () => void;
};

export function DayTemplatePanel({
    templates,
    applyingTemplateId = null,
    error,
    onCreate,
    onEdit,
    onDelete,
    onDragStart,
}: Props) {
    const theme = useTheme();
    const [detailsAnchor, setDetailsAnchor] = useState<HTMLElement | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [templateContextMenu, setTemplateContextMenu] = useState<{
        template: DayTemplate;
        mouseX: number;
        mouseY: number;
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DayTemplate | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const suppressClickRef = useRef(false);
    const resetClickSuppressionTimeoutRef = useRef<number | null>(null);
    const selectedTemplate = templates.find(template => template.id === selectedTemplateId) ?? null;

    useEffect(() => () => {
        if (resetClickSuppressionTimeoutRef.current !== null) {
            window.clearTimeout(resetClickSuppressionTimeoutRef.current);
        }
    }, []);

    const closeDetails = () => {
        setDetailsAnchor(null);
    };

    const openTemplateContextMenu = (event: React.MouseEvent<HTMLElement>, template: DayTemplate) => {
        event.preventDefault();
        event.stopPropagation();
        setTemplateContextMenu({ template, mouseX: event.clientX + 2, mouseY: event.clientY + 2 });
    };

    const closeTemplateContextMenu = () => {
        setTemplateContextMenu(null);
    };

    const requestTemplateDelete = () => {
        if (!templateContextMenu) return;
        setDeleteTarget(templateContextMenu.template);
        setDeleteError(null);
        closeTemplateContextMenu();
        closeDetails();
    };

    const confirmTemplateDelete = async () => {
        if (!deleteTarget) return;

        setDeleting(true);
        setDeleteError(null);
        try {
            await onDelete(deleteTarget.id);
            setDeleteTarget(null);
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Unable to delete the day template.');
        } finally {
            setDeleting(false);
        }
    };

    const handleTemplateClick = (event: React.MouseEvent<HTMLElement>, template: DayTemplate) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        setSelectedTemplateId(template.id);
        setDetailsAnchor(event.currentTarget);
    };

    const handleTemplateDragStart = (event: React.DragEvent<HTMLElement>, template: DayTemplate) => {
        suppressClickRef.current = true;
        if (resetClickSuppressionTimeoutRef.current !== null) {
            window.clearTimeout(resetClickSuppressionTimeoutRef.current);
        }
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData(DAY_TEMPLATE_DRAG_TYPE, template.id);
        onDragStart();
    };

    const handleTemplateDragEnd = () => {
        resetClickSuppressionTimeoutRef.current = window.setTimeout(() => {
            suppressClickRef.current = false;
            resetClickSuppressionTimeoutRef.current = null;
        }, 150);
    };

    const handleTemplateKeyDown = (event: React.KeyboardEvent<HTMLElement>, template: DayTemplate) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setSelectedTemplateId(template.id);
        setDetailsAnchor(event.currentTarget);
    };

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 1.25,
                mb: 1.25,
                backgroundColor: 'background.default',
            }}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: { sm: 190 } }}>
                    <ViewDayIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2">Day templates</Typography>
                </Stack>

                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ flex: 1, minWidth: 0 }}>
                    {templates.map(template => (
                        <Paper
                            key={template.id}
                            component="div"
                            draggable={applyingTemplateId === null}
                            role="button"
                            tabIndex={0}
                            aria-haspopup="dialog"
                            aria-expanded={selectedTemplateId === template.id && Boolean(detailsAnchor)}
                            aria-label={`${template.name}. View contents or drag to apply.`}
                            onClick={event => handleTemplateClick(event, template)}
                            onContextMenu={event => openTemplateContextMenu(event, template)}
                            onKeyDown={event => handleTemplateKeyDown(event, template)}
                            onDragStart={event => handleTemplateDragStart(event, template)}
                            onDragEnd={handleTemplateDragEnd}
                            elevation={2}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                px: 1.25,
                                py: 0.75,
                                maxWidth: 230,
                                borderRadius: 2,
                                border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.16)}`,
                                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.07),
                                cursor: applyingTemplateId === null ? 'grab' : 'default',
                                opacity: applyingTemplateId !== null && applyingTemplateId !== template.id ? 0.55 : 1,
                                userSelect: 'none',
                                transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                                '&:hover': {
                                    transform: 'translateY(-1px)',
                                    boxShadow: theme.shadows[4],
                                    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.25 : 0.12),
                                },
                                '&:focus-visible': {
                                    outline: `2px solid ${theme.palette.primary.main}`,
                                    outlineOffset: 2,
                                },
                                '&:active': {
                                    cursor: 'grabbing',
                                    transform: 'translateY(0)',
                                },
                            }}
                            title={`View ${template.name} contents or drag to apply`}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" noWrap>{template.name}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {template.events.length} event{template.events.length === 1 ? '' : 's'} · {template.tasks.length} task{template.tasks.length === 1 ? '' : 's'}
                                </Typography>
                            </Box>
                        </Paper>
                    ))}
                    {templates.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 0.6 }}>
                            Save a day below as your first reusable template.
                        </Typography>
                    )}
                </Stack>

                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onCreate} sx={{ flexShrink: 0 }}>
                    New template
                </Button>
            </Stack>
            {error && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
                    {error}
                </Typography>
            )}

            <Popover
                open={Boolean(detailsAnchor && selectedTemplate)}
                anchorEl={detailsAnchor}
                onClose={closeDetails}
                TransitionComponent={Fade}
                transitionDuration={{ enter: 180, exit: 140 }}
                aria-labelledby="day-template-details-title"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        sx: {
                            p: 2,
                            width: { xs: 'calc(100vw - 32px)', sm: 320 },
                            maxWidth: 320,
                            maxHeight: 'min(70vh, 420px)',
                            overflowY: 'auto',
                            borderRadius: 2.5,
                        },
                    },
                }}
            >
                {selectedTemplate && (
                    <Stack spacing={1.25}>
                        <Box>
                            <Typography id="day-template-details-title" variant="subtitle1" fontWeight={600}>
                                {selectedTemplate.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {selectedTemplate.events.length} event{selectedTemplate.events.length === 1 ? '' : 's'} · {selectedTemplate.tasks.length} task{selectedTemplate.tasks.length === 1 ? '' : 's'}
                            </Typography>
                        </Box>

                        {selectedTemplate.events.length > 0 && (
                            <TemplateContentSection icon={<EventNoteOutlinedIcon fontSize="small" />} title="Events">
                                {selectedTemplate.events.map(event => (
                                    <ListItem key={event.id} disableGutters sx={{ display: 'block', py: 0.35 }}>
                                        <Typography variant="body2" noWrap>{event.title}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {event.allDay ? 'All day' : formatTemplateTimeRange(event.startTime, event.endTime)}
                                        </Typography>
                                    </ListItem>
                                ))}
                            </TemplateContentSection>
                        )}

                        {selectedTemplate.tasks.length > 0 && (
                            <TemplateContentSection icon={<TaskAltOutlinedIcon fontSize="small" />} title="Tasks">
                                {selectedTemplate.tasks.map(task => (
                                    <ListItem key={task.id} disableGutters sx={{ display: 'block', py: 0.35 }}>
                                        <Typography variant="body2" noWrap>{task.name}</Typography>
                                        {task.scheduledTime && (
                                            <Typography variant="caption" color="text.secondary">
                                                {formatTemplateTime(task.scheduledTime)}
                                            </Typography>
                                        )}
                                    </ListItem>
                                ))}
                            </TemplateContentSection>
                        )}

                        {selectedTemplate.events.length === 0 && selectedTemplate.tasks.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                This template is empty.
                            </Typography>
                        )}
                    </Stack>
                )}
            </Popover>

            <Menu
                open={Boolean(templateContextMenu)}
                onClose={closeTemplateContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={templateContextMenu
                    ? { top: templateContextMenu.mouseY, left: templateContextMenu.mouseX }
                    : undefined}
                MenuListProps={{ dense: true }}
            >
                <MenuItem onClick={() => {
                    if (templateContextMenu) onEdit(templateContextMenu.template);
                    closeTemplateContextMenu();
                }}>
                    <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit template</ListItemText>
                </MenuItem>
                <MenuItem onClick={requestTemplateDelete} sx={{ color: 'error.main' }}>
                    <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineRoundedIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Delete template</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={Boolean(deleteTarget)}
                onClose={() => { if (!deleting) setDeleteTarget(null); }}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        This only removes the reusable template. Events and tasks already created from it will stay on your calendar.
                    </Typography>
                    {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
                    <Button color="error" onClick={() => void confirmTemplateDelete()} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}

function TemplateContentSection({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25, color: 'primary.main' }}>
                {icon}
                <Typography variant="caption" fontWeight={700}>{title}</Typography>
            </Stack>
            <Divider sx={{ mb: 0.25 }} />
            <List dense disablePadding>
                {children}
            </List>
        </Box>
    );
}

function formatTemplateTime(value: string): string {
    return value.slice(0, 5);
}

function formatTemplateTimeRange(startTime: string | null, endTime: string | null): string {
    if (!startTime) return 'Time not set';
    const start = formatTemplateTime(startTime);
    return endTime ? `${start}–${formatTemplateTime(endTime)}` : start;
}
