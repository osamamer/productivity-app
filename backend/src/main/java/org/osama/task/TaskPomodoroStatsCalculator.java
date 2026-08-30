package org.osama.task;

import org.osama.session.task.TaskSession;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

final class TaskPomodoroStatsCalculator {

    private TaskPomodoroStatsCalculator() {
    }

    static TaskPomodoroStatsResponse calculate(
            String taskId,
            List<TaskSession> sessions,
            LocalDate today,
            LocalDateTime now
    ) {
        List<TaskSession> focusSessions = sessions.stream()
                .filter(TaskSession::isPomodoro)
                .toList();

        long totalFocusSeconds = focusSessions.stream()
                .mapToLong(session -> focusSeconds(session, now))
                .sum();
        Set<LocalDate> workedDates = workedDates(focusSessions, now);

        return new TaskPomodoroStatsResponse(
                taskId,
                totalFocusSeconds,
                focusSessions.size(),
                workedDates.size(),
                currentStreak(workedDates, today),
                longestStreak(workedDates),
                workedDates.stream().max(Comparator.naturalOrder()).orElse(null)
        );
    }

    private static long focusSeconds(TaskSession session, LocalDateTime now) {
        Duration storedDuration = session.getTotalSessionTime();
        long seconds = storedDuration == null ? 0 : Math.max(0, storedDuration.toSeconds());
        if (session.isRunning() && session.getLastUnpauseTime() != null) {
            seconds += Math.max(0, Duration.between(session.getLastUnpauseTime(), now).toSeconds());
        }
        return seconds;
    }

    private static Set<LocalDate> workedDates(List<TaskSession> sessions, LocalDateTime now) {
        Set<LocalDate> dates = new TreeSet<>();
        for (TaskSession session : sessions) {
            if (session.getStartTime() != null) {
                dates.add(session.getStartTime().toLocalDate());
            }
            LocalDateTime endTime = session.isActive() ? now : session.getEndTime();
            if (endTime != null) {
                dates.add(endTime.toLocalDate());
            }
        }
        return dates;
    }

    private static int currentStreak(Set<LocalDate> workedDates, LocalDate today) {
        LocalDate cursor = workedDates.contains(today)
                ? today
                : workedDates.contains(today.minusDays(1)) ? today.minusDays(1) : null;
        int streak = 0;
        while (cursor != null && workedDates.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static int longestStreak(Set<LocalDate> workedDates) {
        int longest = 0;
        int current = 0;
        LocalDate previous = null;
        for (LocalDate date : workedDates) {
            current = previous != null && date.equals(previous.plusDays(1)) ? current + 1 : 1;
            longest = Math.max(longest, current);
            previous = date;
        }
        return longest;
    }
}
