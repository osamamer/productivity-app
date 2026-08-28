package org.osama.taskgroup;

import lombok.Data;

import java.util.List;

@Data
public class TaskGroupRequest {
    private String name;
    private List<String> taskIds;
}
