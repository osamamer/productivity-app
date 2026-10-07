package org.osama.task.events;

import java.util.List;

public record TasksRestoredEvent(List<String> taskIds) {
    public TasksRestoredEvent {
        taskIds = List.copyOf(taskIds);
    }
}
