package org.osama.task;

import lombok.Data;

@Data
public class ModifyTaskRequest {
    String taskId;
    String taskDescription;
}
