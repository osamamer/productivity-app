package org.osama.requests;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDateTime;

@Data
public class UpdateTaskRequest {
    private String name;
    private String description;
    private Boolean completed;
    private String tag;
    private Integer importance;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDateTime scheduledPerformDateTime;
}