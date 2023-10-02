package org.osama;

import lombok.Data;
import org.osama.task.Task;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class Day {
    private final List<Task> taskList = new ArrayList<>();
    private final double dayRating;
    private final String dayPlan;
    private final String daySummary;
    private final LocalDateTime date;

    public Day(double dayRating, String dayPlan, String daySummary, LocalDateTime date) {
        this.dayRating = dayRating;
        this.dayPlan = dayPlan;
        this.daySummary = daySummary;
        this.date = date;
    }
    public static Day createNewDay(LocalDateTime date) {
        return new Day(-1, "", "", date);
    }

}
