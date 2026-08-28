package org.osama.task;

import lombok.Data;

import java.util.List;

@Data
public class ReorderTasksRequest {
    private List<String> taskIds;
}
