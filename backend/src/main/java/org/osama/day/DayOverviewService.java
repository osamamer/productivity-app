package org.osama.day;

import org.osama.event.CalendarEventResponse;
import org.osama.event.CalendarEventService;
import org.osama.mentalstate.MentalStateCheckInResponse;
import org.osama.mentalstate.MentalStateService;
import org.osama.note.Note;
import org.osama.note.NoteRepository;
import org.osama.note.NoteResponse;
import org.osama.session.meditation.MeditationSession;
import org.osama.session.meditation.MeditationSessionRepository;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.stat.StatEntry;
import org.osama.stat.StatEntryRepository;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DayOverviewService {
    private final DayRepository dayRepository;
    private final TaskRepository taskRepository;
    private final TaskSessionRepository taskSessionRepository;
    private final StatEntryRepository statEntryRepository;
    private final MeditationSessionRepository meditationSessionRepository;
    private final MentalStateService mentalStateService;
    private final NoteRepository noteRepository;
    private final CalendarEventService calendarEventService;

    public DayOverviewService(DayRepository dayRepository,
                              TaskRepository taskRepository,
                              TaskSessionRepository taskSessionRepository,
                              StatEntryRepository statEntryRepository,
                              MeditationSessionRepository meditationSessionRepository,
                              MentalStateService mentalStateService,
                              NoteRepository noteRepository,
                              CalendarEventService calendarEventService) {
        this.dayRepository = dayRepository;
        this.taskRepository = taskRepository;
        this.taskSessionRepository = taskSessionRepository;
        this.statEntryRepository = statEntryRepository;
        this.meditationSessionRepository = meditationSessionRepository;
        this.mentalStateService = mentalStateService;
        this.noteRepository = noteRepository;
        this.calendarEventService = calendarEventService;
    }

    @Transactional(readOnly = true)
    public DayOverviewResponse getOverview(LocalDate date, String userId) {
        if (date == null) throw new IllegalArgumentException("A day is required.");

        List<StatEntry> dateStats = statEntryRepository.findAllByUserIdAndDate(userId, date);
        DayWindow window = buildDayWindow(date, dateStats);
        List<Task> userTasks = taskRepository.findAllByUserId(userId);
        Map<String, Task> taskById = userTasks.stream()
                .collect(Collectors.toMap(Task::getTaskId, task -> task));
        List<TaskSession> daySessions = taskSessionRepository.findAllByAssociatedTaskIdIn(taskById.keySet()).stream()
                .filter(session -> isWithin(session.getStartTime(), window))
                .sorted(Comparator.comparing(TaskSession::getStartTime, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<DayOverviewResponse.TaskSummary> tasks = userTasks.stream()
                .filter(task -> !task.isSkipped())
                .filter(task -> isTaskPartOfDay(task, date, window))
                .sorted(Comparator.comparing(this::taskTime, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Task::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toTaskSummary)
                .toList();

        List<DayOverviewResponse.FocusSession> focusSessions = daySessions.stream()
                .map(session -> toFocusSession(session, taskById.get(session.getAssociatedTaskId())))
                .toList();

        List<DayOverviewResponse.StatSummary> stats = dateStats.stream()
                .sorted(Comparator.comparing(entry -> entry.getStatDefinition().getDisplayOrder()))
                .map(this::toStatSummary)
                .toList();

        List<DayOverviewResponse.MeditationSummary> meditationSessions = meditationSessionRepository
                .findAllByUserIdOrderByStartTimeAsc(userId).stream()
                .filter(session -> isWithin(session.getStartTime(), window))
                .map(this::toMeditationSummary)
                .toList();

        Instant windowStart = window.start().atZone(ZoneId.systemDefault()).toInstant();
        Instant windowEnd = window.end().atZone(ZoneId.systemDefault()).toInstant();
        List<MentalStateCheckInResponse> mentalStateCheckIns = mentalStateService
                .getHistoryBetween(windowStart, windowEnd, userId);
        List<NoteResponse> notes = noteRepository.findAllByUserIdOrderByPinnedDescUpdatedAtDesc(userId).stream()
                .filter(note -> isNotePartOfDay(note, window))
                .map(NoteResponse::from)
                .toList();
        List<CalendarEventResponse> events = calendarEventService.getEvents(userId);

        DayEntity savedDay = dayRepository.findDayEntityByLocalDateAndUserId(date, userId).orElse(null);
        DayOverviewResponse.DayInfo dayInfo = savedDay == null
                ? new DayOverviewResponse.DayInfo(null, null, null)
                : new DayOverviewResponse.DayInfo(savedDay.getRating(), savedDay.getPlan(), savedDay.getSummary());

        return new DayOverviewResponse(
                date,
                window.start(),
                window.end(),
                dayInfo,
                tasks,
                stats,
                focusSessions,
                meditationSessions,
                mentalStateCheckIns,
                notes,
                events
        );
    }

    private DayWindow buildDayWindow(LocalDate date, List<StatEntry> stats) {
        Integer wakeUpMinutes = statMinutes(stats, "wake_up_time");
        Integer sleepMinutes = statMinutes(stats, "sleep_time");
        LocalDateTime start = date.atStartOfDay().plusMinutes(wakeUpMinutes == null ? 0 : wakeUpMinutes);
        LocalDateTime end;
        if (sleepMinutes == null) {
            end = date.plusDays(1).atStartOfDay();
        } else {
            end = date.atStartOfDay().plusMinutes(sleepMinutes);
            boolean earlyMorningSleep = wakeUpMinutes != null
                    ? sleepMinutes <= wakeUpMinutes
                    : sleepMinutes < 12 * 60;
            if (earlyMorningSleep || !end.isAfter(start)) end = end.plusDays(1);
        }
        return new DayWindow(start, end);
    }

    private Integer statMinutes(List<StatEntry> stats, String systemKey) {
        return stats.stream()
                .filter(entry -> entry.getStatDefinition() != null
                        && systemKey.equals(entry.getStatDefinition().getSystemKey()))
                .findFirst()
                .map(entry -> (int) Math.round(entry.getValue()))
                .orElse(null);
    }

    private boolean isTaskPartOfDay(Task task, LocalDate date, DayWindow window) {
        LocalDateTime activityTime = task.getCompletionDateTime() != null
                ? task.getCompletionDateTime()
                : task.getScheduledPerformDateTime();
        return activityTime != null
                && date.equals(activityTime.toLocalDate())
                && isWithin(activityTime, window);
    }

    private LocalDateTime taskTime(Task task) {
        if (task.getCompletionDateTime() != null) return task.getCompletionDateTime();
        if (task.getScheduledPerformDateTime() != null) return task.getScheduledPerformDateTime();
        return task.getCreationDateTime();
    }

    private DayOverviewResponse.TaskSummary toTaskSummary(Task task) {
        return new DayOverviewResponse.TaskSummary(
                task.getTaskId(), task.getName(), task.getDescription(), task.isCompleted(), task.isSkipped(),
                task.getCreationDateTime(), task.getScheduledPerformDateTime(), task.getCompletionDateTime(),
                task.getParentId(), task.getTag(), task.getImportance()
        );
    }

    private DayOverviewResponse.StatSummary toStatSummary(StatEntry entry) {
        return new DayOverviewResponse.StatSummary(
                entry.getId(),
                entry.getStatDefinition().getId(),
                entry.getStatDefinition().getName(),
                entry.getStatDefinition().getType(),
                entry.getStatDefinition().getSystemKey(),
                entry.getValue(),
                entry.getStatus()
        );
    }

    private DayOverviewResponse.FocusSession toFocusSession(TaskSession session, Task task) {
        LocalDateTime endTime = session.getEndTime();
        if (endTime == null && !session.isRunning()) endTime = session.getLastPauseTime();
        if (endTime == null && session.isRunning()) endTime = LocalDateTime.now();
        return new DayOverviewResponse.FocusSession(
                session.getSessionId(), session.getAssociatedTaskId(), task == null ? "Untitled task" : task.getName(),
                session.isPomodoro(), session.getStartTime(), endTime,
                durationSeconds(session.getTotalSessionTime(), session.isRunning(), session.getLastUnpauseTime())
        );
    }

    private DayOverviewResponse.MeditationSummary toMeditationSummary(MeditationSession session) {
        LocalDateTime endTime = session.getEndTime();
        if (endTime == null && session.isRunning()) endTime = LocalDateTime.now();
        return new DayOverviewResponse.MeditationSummary(
                session.getId(), session.getStartTime(), endTime,
                durationSeconds(session.getTotalSessionTime(), session.isRunning(), session.getLastUnpauseTime()),
                session.getMoodBefore(), session.getMoodAfter()
        );
    }

    private long durationSeconds(Duration stored, boolean running, LocalDateTime lastUnpauseTime) {
        Duration duration = stored == null ? Duration.ZERO : stored;
        if (running && lastUnpauseTime != null) {
            duration = duration.plus(Duration.between(lastUnpauseTime, LocalDateTime.now()));
        }
        return Math.max(0, duration.toSeconds());
    }

    private boolean isWithin(LocalDateTime time, DayWindow window) {
        return time != null && !time.isBefore(window.start()) && time.isBefore(window.end());
    }

    private boolean isNotePartOfDay(Note note, DayWindow window) {
        return isWithin(note.getCreatedAt(), window) || isWithin(note.getUpdatedAt(), window);
    }

    private record DayWindow(LocalDateTime start, LocalDateTime end) {
    }
}
