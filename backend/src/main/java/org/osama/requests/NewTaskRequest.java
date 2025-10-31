package org.osama.requests;

import lombok.Data;

@Data
public class NewTaskRequest {
    public String taskName;
    public String taskDescription;
    public String taskPerformTime;
    public String parentTaskId;
    public String taskTag;
    public int taskImportance;
}
