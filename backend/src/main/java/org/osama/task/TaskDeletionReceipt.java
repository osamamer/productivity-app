package org.osama.task;

import org.osama.stat.StatEntryStatus;
import org.osama.stat.StatType;

import java.time.LocalDate;
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
        Map<String, TaskSeriesState> taskSeriesStatesToRestore,
        List<StatEntryState> statEntriesToRestore
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
                taskGroupIds, taskGroupMembershipIds, linkedStatDefinitionsBySeries, Map.of(), List.of());
    }

    public TaskDeletionReceipt(
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
        this(taskIds, taskSeriesIds, taskSessionIds, scheduledJobIds, pomodoroIds, reminderIds,
                taskGroupIds, taskGroupMembershipIds, linkedStatDefinitionsBySeries, taskSeriesStatesToRestore, List.of());
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
        statEntriesToRestore = statEntriesToRestore == null ? List.of() : List.copyOf(statEntriesToRestore);
    }

    public record TaskSeriesState(java.time.LocalDate recurrenceEndDate, boolean active) {}

    public record StatEntryState(
            String statDefinitionId,
            LocalDate date,
            boolean existed,
            Double value,
            StatEntryStatus status,
            Map<StatType, Double> additionalValues
    ) {
        public StatEntryState {
            additionalValues = additionalValues == null ? Map.of() : Map.copyOf(additionalValues);
        }
    }

    public static TaskDeletionReceipt empty() {
        return new TaskDeletionReceipt(
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), Map.of(), Map.of(), List.of());
    }

    private static List<String> immutableList(List<String> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
