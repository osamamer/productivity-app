package org.osama.requests;

import lombok.Data;

@Data
public class UpdateTaskRequest {
    private String name;
    private String description;
    private Boolean completed;
    private String tag;
    private Integer importance;

    private String scheduledPerformDateTime;
}
