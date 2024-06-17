package org.osama.task.requests;

import lombok.Data;

@Data
public class ModifyTaskRequest {
    public String taskId;
    public String taskDescription;
}
