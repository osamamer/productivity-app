package org.osama.path;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Create or update a milestone. Absent fields keep their value on update; {@code targetDate} is
 * presence-tracked so null clears it (moving the ring to Someday). {@code done} marks the project done.
 */
@Getter
@NoArgsConstructor
public class MilestoneRequest {
    private String name;
    private LocalDate targetDate;
    private boolean targetDatePresent;
    private Integer displayOrder;
    private Boolean done;

    public MilestoneRequest(String name, LocalDate targetDate) {
        this.name = name;
        setTargetDate(targetDate);
    }

    @JsonSetter("name") public void setName(String name) { this.name = name; }
    @JsonSetter("targetDate") public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; this.targetDatePresent = true; }
    @JsonSetter("displayOrder") public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    @JsonSetter("done") public void setDone(Boolean done) { this.done = done; }
}
