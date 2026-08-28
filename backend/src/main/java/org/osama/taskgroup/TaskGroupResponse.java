package org.osama.taskgroup;

import org.osama.task.Task;

import java.util.Comparator;
import java.util.List;

public record TaskGroupResponse(String groupId, String name, List<String> taskIds, int displayOrder) {
    static TaskGroupResponse from(TaskGroup group) {
        List<String> taskIds = group.getTasks().stream()
                .sorted(Comparator.comparingInt(Task::getDisplayOrder).thenComparing(Task::getTaskId))
                .map(Task::getTaskId)
                .toList();
        return new TaskGroupResponse(group.getGroupId(), group.getName(), taskIds, group.getDisplayOrder());
    }
}
