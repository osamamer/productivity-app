package org.osama;

import jakarta.persistence.Embeddable;
import lombok.Data;
import org.osama.task.Task;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Embeddable
public class Day {
    private List<Task> taskList = new ArrayList<>();
    private double dayRating;
    private String dayPlan;
    private String daySummary;
    private LocalDateTime date;

    public Day() {

    }

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
