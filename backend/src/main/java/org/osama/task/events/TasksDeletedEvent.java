package org.osama.task.events;

import java.util.List;

public record TasksDeletedEvent(List<String> taskIds) {
    public TasksDeletedEvent {
        taskIds = List.copyOf(taskIds);
    }
}
