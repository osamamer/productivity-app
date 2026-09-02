export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
}

export interface Task {
  taskId: string;
  name: string;
  description: string;
  completed: boolean;
  creationDateTime: string;
  creationDate: string;
  scheduledPerformDateTime: string;
  completionDateTime: string;
  parentId: string;
  tag: string;
  importance: number;
  displayOrder: number;
  mentalThreadId: string | null;
}

export interface TaskInput {
  name: string;
  description: string;
  scheduledPerformDateTime: string;
  tag: string;
  importance: number;
  parentId?: string;
  mentalThreadId?: string;
}

export interface TaskGroup {
  groupId: string;
  name: string;
  taskIds: string[];
  displayOrder: number;
}

export interface Day {
  id: number;
  rating: number;
  plan: string;
  summary: string;
  localDate: string;
}

export type AttentionState = 'ACTING' | 'RUMINATING' | 'PLANNED' | 'PENDING';
export type MentalThreadStatus = 'OPEN' | 'CLOSED';
export type ClosureType = 'RESOLVED' | 'ACCEPTED' | 'RELEASED';

export interface MentalThread {
  id: string;
  title: string;
  description: string | null;
  status: MentalThreadStatus;
  attentionState: AttentionState;
  desiredResolution: string | null;
  closureType: ClosureType | null;
  resolutionSummary: string | null;
  openedAt: string;
  targetCloseDate: string | null;
  hardDeadlineDate: string | null;
  nextReviewDate: string | null;
  closedAt: string | null;
  currentMentalLoad: number;
  createdAt: string;
  updatedAt: string;
}

export interface MentalThreadInput {
  title: string;
  description: string | null;
  attentionState: AttentionState;
  desiredResolution: string | null;
  targetCloseDate: string | null;
  hardDeadlineDate: string | null;
  nextReviewDate: string | null;
  currentMentalLoad: number;
  loadReason: string | null;
}

export interface MentalThreadSummary {
  openThreadCount: number;
  totalLoad: number;
  highLoadCount: number;
  actingCount: number;
  ruminatingCount: number;
  plannedCount: number;
  pendingCount: number;
  capacityToday: number | null;
}

export interface MentalStateRequest {
  energy: number;
  activation: number;
  stimulationHunger: number;
  clarity: number;
  valence: number;
  emotionalLoad: number;
}

export interface MentalStateCheckIn {
  id: string;
  recordedAt: string;
  state: string;
  suggestedActions: string[];
}

export type StatType = 'NUMBER' | 'BOOLEAN' | 'RANGE';
export type StatMorality = 'GOOD' | 'BAD' | 'NEUTRAL';

export interface StatDefinition {
  id: string;
  name: string;
  description?: string;
  type: StatType;
  morality?: StatMorality | null;
  minValue?: number;
  maxValue?: number;
  goodThreshold?: number | null;
  systemKey?: string;
  displayOrder: number;
  userId: string;
}

export interface StatEntry {
  id: string;
  statDefinitionId: string;
  statDefinition: StatDefinition;
  date: string;
  value: number;
  userId: string;
}

export interface StatSummary {
  checkInStreak: number;
  periodYesCount: number | null;
  booleanStreak: number | null;
  periodAverage: number | null;
  periodTotal: number | null;
  periodHighest?: number | null;
}

export interface NoteCategory {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  categoryId: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  allDay: boolean;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timeZone: string;
  recurrenceFrequency: RecurrenceFrequency;
  recurrenceEndDate: string | null;
  recurrenceInterval: number | null;
  recurrenceUnit: RecurrenceUnit | null;
  reminderMinutesBefore: number | null;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventInput = Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>;

export interface MeditationSession {
  id: string;
  running: boolean;
  active: boolean;
  totalSessionTime: string | number | [number, number] | null;
  startTime: string | null;
  lastUnpauseTime: string | null;
  lastPauseTime: string | null;
  endTime: string | null;
  moodBefore: number;
  moodAfter: number;
  numIntervalBells: number;
  intendedLength: number;
}

export interface ApplicationNotification {
  notificationId: string;
  type: string;
  title: string;
  body: string | null;
  targetUrl: string | null;
  scheduledAt: string;
  eventStart: string | null;
  allDay: boolean | null;
}

export interface UserPreferences {
  includeUnloggedNumericDaysAsZero: boolean;
  autoStartPomodoroSessions: boolean;
}

export type PomodoroPhase = 'FOCUS' | 'BREAK' | 'WAITING_FOR_BREAK' | 'WAITING_FOR_FOCUS';

export interface PomodoroStatus {
  pomodoroId: string;
  associatedTaskId: string;
  active: boolean;
  sessionActive: boolean;
  sessionRunning: boolean;
  secondsPassedInSession: number;
  secondsUntilNextTransition: number;
  currentFocusNumber: number;
  numFocuses: number;
  phase?: PomodoroPhase;
}

export interface PomodoroConfig {
  secondsMode: boolean;
  durationUnit: 'minutes' | 'seconds';
  defaultFocusDuration: number;
  defaultShortBreakDuration: number;
  defaultLongBreakDuration: number;
}
