package org.osama.task;

import org.junit.jupiter.api.Test;
import org.osama.session.task.TaskSession;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskPomodoroStatsCalculatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 30);
    private static final LocalDateTime NOW = TODAY.atTime(12, 0);

    @Test
    void calculatesFocusTotalsDaysAndStreaks() {
        TaskPomodoroStatsResponse stats = TaskPomodoroStatsCalculator.calculate(
                "task-1",
                List.of(
                        endedPomodoro(TODAY, 25),
                        endedPomodoro(TODAY.minusDays(1), 10),
                        endedPomodoro(TODAY.minusDays(2), 15),
                        endedPomodoro(TODAY.minusDays(4), 5),
                        endedRegularSession(TODAY, 90)
                ),
                TODAY,
                NOW
        );

        assertEquals("task-1", stats.taskId());
        assertEquals(Duration.ofMinutes(55).toSeconds(), stats.totalFocusSeconds());
        assertEquals(4, stats.totalFocusSessions());
        assertEquals(4, stats.totalDaysWorked());
        assertEquals(3, stats.currentStreakDays());
        assertEquals(3, stats.longestStreakDays());
        assertEquals(TODAY, stats.lastWorkedOnDate());
    }

    @Test
    void includesTheRunningPartOfAnActiveFocusSession() {
        TaskSession session = new TaskSession();
        session.setPomodoro(true);
        session.setActive(true);
        session.setRunning(true);
        session.setTotalSessionTime(Duration.ofSeconds(30));
        session.setStartTime(NOW.minusSeconds(90));
        session.setLastUnpauseTime(NOW.minusSeconds(60));

        TaskPomodoroStatsResponse stats = TaskPomodoroStatsCalculator.calculate(
                "task-1", List.of(session), TODAY, NOW);

        assertEquals(90, stats.totalFocusSeconds());
        assertEquals(1, stats.currentStreakDays());
    }

    private static TaskSession endedPomodoro(LocalDate date, long minutes) {
        TaskSession session = endedRegularSession(date, minutes * 60);
        session.setPomodoro(true);
        return session;
    }

    private static TaskSession endedRegularSession(LocalDate date, long seconds) {
        TaskSession session = new TaskSession();
        session.setPomodoro(false);
        session.setActive(false);
        session.setRunning(false);
        session.setTotalSessionTime(Duration.ofSeconds(seconds));
        session.setStartTime(date.atTime(9, 0));
        session.setEndTime(date.atTime(10, 0));
        return session;
    }
}
