package org.osama;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class Day {
    private final List<Task> taskList = new ArrayList<>();
    private double dayRating;
    private String dayPlan;
    private String daySummary;
    private final LocalDateTime date;

    public Day(LocalDateTime date) {
        this.date = date;
    }
}
