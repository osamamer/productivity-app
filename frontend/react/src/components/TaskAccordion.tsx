import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, List, SxProps, Theme, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Task } from '../types/Task';
import { TaskDiv } from './TaskDiv';

type TaskAccordionProps = {
    title: string;
    tasks: Task[];
    defaultExpanded?: boolean;
    expanded?: boolean;
    onChange?: (event: React.SyntheticEvent, isExpanded: boolean) => void;
    toggleTaskCompletion: (taskId: string) => void;
    onTaskClick: (task: Task) => void;
    accordionSx?: SxProps<Theme>;
    summarySx?: SxProps<Theme>;
    detailsSx?: SxProps<Theme>;
    listSx?: SxProps<Theme>;
    renderTasks?: (tasks: Task[]) => React.ReactNode;
};

export function TaskAccordion({
                                  title,
                                  tasks,
                                  defaultExpanded = false,
                                  expanded,
                                  onChange,
                                  toggleTaskCompletion,
                                  onTaskClick,
                                  accordionSx,
                                  summarySx,
                                  detailsSx,
                                  listSx,
                                  renderTasks,
                              }: TaskAccordionProps) {
    if (!tasks || tasks.length === 0) return null;
    const accordionProps = expanded !== undefined
        ? { expanded: expanded, onChange: onChange }
        : { defaultExpanded: defaultExpanded };

    return (
        <Accordion {...accordionProps}
            defaultExpanded={defaultExpanded}
            sx={{
                borderRadius: 2,
                mb: 2,
                boxShadow: 'none',
                background: 'transparent',
                backgroundImage: 'none',
                '&:before': {
                    display: 'none',
                },
                '&.Mui-expanded': {
                    margin: '0 0 16px 0',
                },
                ...accordionSx,
            }}
        >
            <AccordionSummary
                expandIcon={<ArrowDropDownIcon />}
                sx={{
                    borderRadius: 2,
                    background: 'transparent',
                    '&.Mui-expanded': {
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                    },
                    ...summarySx,
                }}
            >
                <Typography variant="h6">{title}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, background: 'transparent', ...detailsSx }}>
                {renderTasks ? (
                    renderTasks(tasks.filter((task) => !task.parentId))
                ) : (
                    <List sx={{ py: 0, ...listSx }}>
                        {tasks.filter((task) => !task.parentId).map((task: Task) => (
                            <TaskDiv
                                key={task.taskId}
                                task={task}
                                toggleTaskCompletion={toggleTaskCompletion}
                                onClick={onTaskClick}
                            />
                        ))}
                    </List>
                )}
            </AccordionDetails>
        </Accordion>
    );
}
