package org.osama.requests;

import lombok.Data;
import javax.validation.constraints.*;

@Data
public class NewTaskRequest {
    @NotNull(message = "Task name is required")
    @Size(min = 1, max = 255, message = "Task name must be between 1 and 255 characters")
    private String name;

    @Size(max = 2000, message = "Description must not exceed 2000 characters")
    private String description;

    private String scheduledPerformDateTime;

    private String parentId;

    @Size(max = 50, message = "Tag must not exceed 50 characters")
    private String tag;

    @Min(value = 0, message = "Importance must be at least 0")
    @Max(value = 10, message = "Importance must not exceed 10")
    private int importance = 0;
}