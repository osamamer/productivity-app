package org.osama.project;

import com.fasterxml.jackson.annotation.JsonSetter;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Create or update a checkpoint. On update, absent fields keep their value; {@code targetDate}
 * is presence-tracked so it can be cleared with null. {@code countFrom} defaults to the project's
 * creation date and {@code valueSource} to VALUE.
 */
@Getter
@NoArgsConstructor
public class CheckpointRequest {
    private String name;
    private LocalDate targetDate;
    private boolean targetDatePresent;
    private Integer displayOrder;
    private String statDefinitionId;
    private String valueSource;
    private CheckpointAggregation aggregation;
    private LocalDate countFrom;
    private Double baseline;
    private Double targetValue;

    public CheckpointRequest(String name, LocalDate targetDate, String statDefinitionId, CheckpointAggregation aggregation,
                             Double baseline, Double targetValue) {
        this.name = name;
        setTargetDate(targetDate);
        this.statDefinitionId = statDefinitionId;
        this.aggregation = aggregation;
        this.baseline = baseline;
        this.targetValue = targetValue;
    }

    @JsonSetter("name") public void setName(String name) { this.name = name; }
    @JsonSetter("targetDate") public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; this.targetDatePresent = true; }
    @JsonSetter("displayOrder") public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    @JsonSetter("statDefinitionId") public void setStatDefinitionId(String statDefinitionId) { this.statDefinitionId = statDefinitionId; }
    @JsonSetter("valueSource") public void setValueSource(String valueSource) { this.valueSource = valueSource; }
    @JsonSetter("aggregation") public void setAggregation(CheckpointAggregation aggregation) { this.aggregation = aggregation; }
    @JsonSetter("countFrom") public void setCountFrom(LocalDate countFrom) { this.countFrom = countFrom; }
    @JsonSetter("baseline") public void setBaseline(Double baseline) { this.baseline = baseline; }
    @JsonSetter("targetValue") public void setTargetValue(Double targetValue) { this.targetValue = targetValue; }
}
