import { CalendarEvent } from './CalendarEvent';
import { StatType } from './Stats';

export interface DayOverview {
    date: string;
    dayStart: string;
    dayEnd: string;
    day: {
        rating: number | null;
        plan: string | null;
        summary: string | null;
    };
    tasks: DayTask[];
    stats: DayStat[];
    focusSessions: DayFocusSession[];
    meditationSessions: DayMeditationSession[];
    mentalStateCheckIns: DayMentalStateCheckIn[];
    notes: DayNote[];
    events: CalendarEvent[];
}

export interface DayTask {
    id: string;
    name: string;
    description: string | null;
    completed: boolean;
    skipped: boolean;
    createdAt: string;
    scheduledAt: string | null;
    completedAt: string | null;
    parentId: string | null;
    tag: string | null;
    importance: number;
}

export interface DayStat {
    id: string;
    definitionId: string;
    name: string;
    type: StatType;
    systemKey: string | null;
    value: number;
}

export interface DayFocusSession {
    id: string;
    taskId: string;
    taskName: string;
    pomodoro: boolean;
    startTime: string;
    endTime: string | null;
    durationSeconds: number;
}

export interface DayMeditationSession {
    id: string;
    startTime: string;
    endTime: string | null;
    durationSeconds: number;
    moodBefore: number;
    moodAfter: number;
}

export interface DayMentalStateCheckIn {
    id: string;
    recordedAt: string;
    state: string;
    suggestedActions: string[];
}

export interface DayNote {
    id: string;
    title: string;
    content: string;
    categoryId: string | null;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
}
