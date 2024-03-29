package org.osama.task;

import lombok.Data;

@Data
public class NewTaskRequest {
    String taskName;
    String taskDescription;
    String taskPerformTime;
    String parentTaskId;
    String taskTag;
    int taskImportance;
}