package org.osama.task;

import java.util.List;
import java.util.Map;

public record TaskDeletionReceipt(
        List<String> taskIds,
        List<String> taskSeriesIds,
        List<String> taskSessionIds,
        List<String> scheduledJobIds,
        List<String> pomodoroIds,
        List<String> reminderIds,
        List<String> taskGroupIds,
        List<String> taskGroupMembershipIds,
        Map<String, String> linkedStatDefinitionsBySeries,
        Map<String, TaskSeriesState> taskSeriesStatesToRestore
) {
    public TaskDeletionReceipt(
            List<String> taskIds,
            List<String> taskSeriesIds,
            List<String> taskSessionIds,
            List<String> scheduledJobIds,
            List<String> pomodoroIds,
            List<String> reminderIds,
            List<String> taskGroupIds,
            List<String> taskGroupMembershipIds,
            Map<String, String> linkedStatDefinitionsBySeries
    ) {
        this(taskIds, taskSeriesIds, taskSessionIds, scheduledJobIds, pomodoroIds, reminderIds,
                taskGroupIds, taskGroupMembershipIds, linkedStatDefinitionsBySeries, Map.of());
    }

    public TaskDeletionReceipt {
        taskIds = immutableList(taskIds);
        taskSeriesIds = immutableList(taskSeriesIds);
        taskSessionIds = immutableList(taskSessionIds);
        scheduledJobIds = immutableList(scheduledJobIds);
        pomodoroIds = immutableList(pomodoroIds);
        reminderIds = immutableList(reminderIds);
        taskGroupIds = immutableList(taskGroupIds);
        taskGroupMembershipIds = immutableList(taskGroupMembershipIds);
        linkedStatDefinitionsBySeries = linkedStatDefinitionsBySeries == null
                ? Map.of()
                : Map.copyOf(linkedStatDefinitionsBySeries);
        taskSeriesStatesToRestore = taskSeriesStatesToRestore == null
                ? Map.of()
                : Map.copyOf(taskSeriesStatesToRestore);
    }

    public record TaskSeriesState(java.time.LocalDate recurrenceEndDate, boolean active) {}

    public static TaskDeletionReceipt empty() {
        return new TaskDeletionReceipt(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), Map.of(), Map.of());
    }

    private static List<String> immutableList(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
