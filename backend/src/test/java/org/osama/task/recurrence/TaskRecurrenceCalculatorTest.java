package org.osama.task.recurrence;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TaskRecurrenceCalculatorTest {
    @Test
    void monthlyRecurrenceKeepsTheOriginalAnchorDayWhenAshortMonthIsEncountered() {
        TaskSeries series = series(LocalDateTime.of(2025, 1, 31, 9, 30));
        series.setRecurrenceFrequency(TaskRecurrenceFrequency.MONTHLY);

        assertEquals(
                List.of(
                        LocalDateTime.of(2025, 1, 31, 9, 30),
                        LocalDateTime.of(2025, 2, 28, 9, 30),
                        LocalDateTime.of(2025, 3, 31, 9, 30)
                ),
                TaskRecurrenceCalculator.occurrencesBetween(
                        series,
                        LocalDateTime.of(2025, 1, 1, 0, 0),
                        LocalDateTime.of(2025, 4, 1, 0, 0))
        );
    }

    @Test
    void recurrenceEndDateIsInclusive() {
        TaskSeries series = series(LocalDateTime.of(2025, 1, 1, 9, 0));
        series.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        series.setRecurrenceEndDate(LocalDate.of(2025, 1, 3));

        assertEquals(3, TaskRecurrenceCalculator.occurrencesBetween(
                series,
                series.getStartDateTime(),
                LocalDateTime.of(2025, 1, 10, 0, 0)).size());
    }

    @Test
    void customRecurrenceAdvancesByItsConfiguredUnitAndInterval() {
        TaskSeries series = series(LocalDateTime.of(2025, 1, 6, 8, 0));
        series.setRecurrenceFrequency(TaskRecurrenceFrequency.CUSTOM);
        series.setRecurrenceInterval(2);
        series.setRecurrenceUnit(TaskRecurrenceUnit.WEEKS);

        assertEquals(
                List.of(
                        LocalDateTime.of(2025, 1, 6, 8, 0),
                        LocalDateTime.of(2025, 1, 20, 8, 0),
                        LocalDateTime.of(2025, 2, 3, 8, 0)
                ),
                TaskRecurrenceCalculator.occurrencesBetween(
                        series,
                        series.getStartDateTime(),
                        LocalDateTime.of(2025, 2, 10, 0, 0))
        );
    }

    private TaskSeries series(LocalDateTime start) {
        TaskSeries series = new TaskSeries();
        series.setStartDateTime(start);
        series.setTimeZone("UTC");
        return series;
    }
}
