import { Box, Button, CircularProgress, Popover, Typography } from '@mui/material';
import { requestHasRecurringTasks } from './homeTaskDeletion';
import type { DeleteRequest, DeleteScope } from './homeTypes';

type HomeDeletePopoverProps = {
    request: DeleteRequest | null;
    submitting: boolean;
    onClose: () => void;
    onConfirm: (scope: DeleteScope) => void;
    onUngroup: () => void;
};

/** Confirms deleting a task, a selection or a group; recurring tasks choose which occurrences go. */
export function HomeDeletePopover({ request, submitting, onClose, onConfirm, onUngroup }: HomeDeletePopoverProps) {
    return (
        <Popover
            open={request !== null}
            anchorEl={request?.anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{
                paper: {
                    sx: {
                        p: 1.5,
                        width: request && requestHasRecurringTasks(request)
                            ? request.kind === 'group' ? 480 : 380
                            : 270,
                        maxWidth: 'calc(100vw - 32px)',
                        borderRadius: 2.5,
                    },
                },
            }}
        >
            {request && (
                <Box>
                    <Typography variant="body2" sx={{ mb: 1.25 }}>
                        {request.kind === 'group'
                            ? request.group.isStatGroup
                                ? `Remove “${request.group.name}” from task groups? Its tasks and statistics will remain.`
                                : `Delete “${request.group.name}” and its ${request.tasks.length} task${request.tasks.length === 1 ? '' : 's'}?`
                            : request.kind === 'bulk'
                                ? `Delete ${request.tasks.length} selected task${request.tasks.length > 1 ? 's' : ''}?`
                                : request.tasks[0].taskSeriesId
                                    ? `Choose which occurrences of “${request.tasks[0].name}” to delete?`
                                    : `Delete “${request.tasks[0].name}” and its subtasks?`}
                    </Typography>
                    {requestHasRecurringTasks(request) ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: request.kind === 'group'
                                    ? 'repeat(3, minmax(0, 1fr))'
                                    : 'repeat(2, minmax(0, 1fr))',
                                gap: 0.5,
                                '& .MuiButton-root': {
                                    width: '100%',
                                    minWidth: 0,
                                    minHeight: 38,
                                    px: 0.75,
                                    py: 0.5,
                                    lineHeight: 1.2,
                                    whiteSpace: 'normal',
                                },
                            }}
                        >
                            <Button
                                size="small"
                                onClick={() => onConfirm('occurrence')}
                                disabled={submitting}
                            >
                                {request.kind === 'single' ? 'This occurrence' : 'Selected occurrences'}
                            </Button>
                            <Button
                                size="small"
                                onClick={() => onConfirm('future')}
                                disabled={submitting}
                            >
                                Future occurrences
                            </Button>
                            {request.kind !== 'group' && (
                                <Button size="small" onClick={onClose} disabled={submitting}>
                                    Cancel
                                </Button>
                            )}
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => onConfirm('series')}
                                disabled={submitting}
                            >
                                {submitting ? 'Deleting…' : 'Delete series'}
                            </Button>
                            {request.kind === 'group' && !request.group.isStatGroup && (
                                <Button size="small" onClick={onUngroup} disabled={submitting}>
                                    Ungroup
                                </Button>
                            )}
                            {request.kind === 'group' && (
                                <Button size="small" onClick={onClose} disabled={submitting}>
                                    Cancel
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
                            <Button size="small" onClick={onClose} disabled={submitting}>
                                Cancel
                            </Button>
                            {request.kind === 'group' && !request.group.isStatGroup && (
                                <Button size="small" onClick={onUngroup} disabled={submitting}>
                                    Ungroup
                                </Button>
                            )}
                            <Button
                                size="small"
                                color="error"
                                variant="contained"
                                onClick={() => onConfirm('occurrence')}
                                disabled={submitting}
                            >
                                {submitting
                                    ? <CircularProgress size={16} color="inherit" />
                                    : request.kind === 'group' && request.group.isStatGroup
                                        ? 'Remove group'
                                        : 'Delete'}
                            </Button>
                        </Box>
                    )}
                </Box>
            )}
        </Popover>
    );
}
