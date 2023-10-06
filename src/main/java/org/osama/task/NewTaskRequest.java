package org.osama.task;

import lombok.Data;

@Data
public class NewTaskRequest {
    String taskName;
    String taskDescription;
}
