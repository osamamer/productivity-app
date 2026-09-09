package org.osama.day;

import org.osama.event.CalendarEventResponse;
import org.osama.mentalstate.MentalStateCheckInResponse;
import org.osama.note.NoteResponse;
import org.osama.stat.StatType;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record DayOverviewResponse(
        LocalDate date,
        LocalDateTime dayStart,
        LocalDateTime dayEnd,
        DayInfo day,
        List<TaskSummary> tasks,
        List<StatSummary> stats,
        List<FocusSession> focusSessions,
        List<MeditationSummary> meditationSessions,
        List<MentalStateCheckInResponse> mentalStateCheckIns,
        List<NoteResponse> notes,
        List<CalendarEventResponse> events
) {
    public record DayInfo(
            Double rating,
            String plan,
            String summary
    ) {
    }

    public record TaskSummary(
            String id,
            String name,
            String description,
            boolean completed,
            boolean skipped,
            LocalDateTime createdAt,
            LocalDateTime scheduledAt,
            LocalDateTime completedAt,
            String parentId,
            String tag,
            int importance
    ) {
    }

    public record StatSummary(
            String id,
            String definitionId,
            String name,
            StatType type,
            String systemKey,
            double value
    ) {
    }

    public record FocusSession(
            String id,
            String taskId,
            String taskName,
            boolean pomodoro,
            LocalDateTime startTime,
            LocalDateTime endTime,
            long durationSeconds
    ) {
    }

    public record MeditationSummary(
            String id,
            LocalDateTime startTime,
            LocalDateTime endTime,
            long durationSeconds,
            int moodBefore,
            int moodAfter
    ) {
    }
}
