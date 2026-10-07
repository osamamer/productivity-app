import { memo } from 'react';
import {
    Box,
    IconButton,
    LinearProgress,
    List,
    ListItemButton,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { Project } from '../../types/Project';
import { projectProgressPercent } from './projectsPresentation';
import { ProjectIdentityIcon, projectAccent } from './projectAppearance';

interface ProjectListProps {
    projects: Project[];
    selectedId: string | null;
    onSelect: (projectId: string) => void;
    onOpenMenu: (project: Project, anchorEl: HTMLElement) => void;
}

interface ProjectRowProps {
    project: Project;
    isSelected: boolean;
    isLast: boolean;
    onSelect: (projectId: string) => void;
    onOpenMenu: (project: Project, anchorEl: HTMLElement) => void;
}

const ProjectRow = memo(function ProjectRow({
    project,
    isSelected,
    isLast,
    onSelect,
    onOpenMenu,
}: ProjectRowProps) {
    return (
        <ListItemButton
            data-project-id={project.projectId}
            selected={isSelected}
            onClick={() => onSelect(project.projectId)}
            onContextMenu={event => {
                event.preventDefault();
                onOpenMenu(project, event.currentTarget);
            }}
            sx={theme => {
                const accent = projectAccent(theme, project.color);
                return {
                    display: 'block',
                    px: 2,
                    py: 1.25,
                    borderBottom: isLast ? 0 : 1,
                    borderColor: 'divider',
                    borderLeft: `3px solid ${isSelected ? accent : 'transparent'}`,
                    textAlign: 'left',
                    '&.Mui-selected': { bgcolor: alpha(accent, 0.08) },
                    '&.Mui-selected:hover': { bgcolor: alpha(accent, 0.12) },
                };
            }}
        >
            <Stack direction="row" alignItems="flex-start" spacing={1.25}>
                <ProjectIdentityIcon color={project.color} icon={project.icon} size={34} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {project.name}
                    </Typography>
                    {project.description && (
                        <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                            {project.description}
                        </Typography>
                    )}
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75 }}>
                        <LinearProgress
                            variant="determinate"
                            value={projectProgressPercent(project)}
                            aria-label={`${project.completedTaskCount} of ${project.taskCount} tasks completed`}
                            sx={theme => ({
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                '& .MuiLinearProgress-bar': { bgcolor: projectAccent(theme, project.color) },
                            })}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                            {project.completedTaskCount}/{project.taskCount}
                        </Typography>
                    </Stack>
                </Box>
                <IconButton
                    size="small"
                    aria-label={`Actions for ${project.name}`}
                    onClick={event => {
                        event.stopPropagation();
                        onOpenMenu(project, event.currentTarget);
                    }}
                    sx={{ mt: -0.5, mr: -0.75, color: 'text.secondary' }}
                >
                    <MoreHorizRoundedIcon fontSize="small" />
                </IconButton>
            </Stack>
        </ListItemButton>
    );
});

export function ProjectList({ projects, selectedId, onSelect, onOpenMenu }: ProjectListProps) {
    return (
        <List disablePadding>
            {projects.map((project, index) => (
                <ProjectRow
                    key={project.projectId}
                    project={project}
                    isSelected={project.projectId === selectedId}
                    isLast={index === projects.length - 1}
                    onSelect={onSelect}
                    onOpenMenu={onOpenMenu}
                />
            ))}
        </List>
    );
}
