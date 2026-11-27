package org.osama.task.recurrence;

import org.osama.recurrence.RecurrenceDays;

import java.time.DayOfWeek;
import java.util.List;

final class TaskRecurrenceDays {
    private TaskRecurrenceDays() {
    }

    static String encode(List<DayOfWeek> days) {
        return RecurrenceDays.encode(days);
    }

    static List<DayOfWeek> decode(String encoded) {
        return RecurrenceDays.decode(encoded);
    }
}
