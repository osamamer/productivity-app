package org.osama.task;

import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class TaskSpecifications {

    public static Specification<Task> isMainTask() {
        return (root, query, cb) -> cb.isNull(root.get("parentId"));
    }

    public static Specification<Task> hasParent(String parentId) {
        return (root, query, cb) -> cb.equal(root.get("parentId"), parentId);
    }

    public static Specification<Task> isCompleted(boolean completed) {
        return (root, query, cb) -> cb.equal(root.get("completed"), completed);
    }

    public static Specification<Task> hasScheduledDate(LocalDate date) {
        return (root, query, cb) -> {
            LocalDateTime startOfDay = date.atStartOfDay();
            LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();
            return cb.between(root.get("scheduledPerformDateTime"), startOfDay, endOfDay);
        };
    }

    public static Specification<Task> scheduledBefore(LocalDate date) {
        return (root, query, cb) -> {
            LocalDateTime startOfDay = date.atStartOfDay();
            return cb.lessThan(root.get("scheduledPerformDateTime"), startOfDay);
        };
    }

    public static Specification<Task> scheduledAfter(LocalDate date) {
        return (root, query, cb) -> {
            LocalDateTime endOfDay = date.plusDays(1).atStartOfDay();
            return cb.greaterThanOrEqualTo(root.get("scheduledPerformDateTime"), endOfDay);
        };
    }

    public static Specification<Task> hasMinImportance(int minImportance) {
        return (root, query, cb) ->
                cb.greaterThanOrEqualTo(root.get("importance"), minImportance);
    }

    public static Specification<Task> hasTag(String tag) {
        return (root, query, cb) -> cb.equal(root.get("tag"), tag);
    }

    // Composite specifications
    public static Specification<Task> matchesQuery(TaskQuery taskQuery) {
        Specification<Task> spec = Specification.where(null);

        // Main tasks by default (unless parentId is specified)
        if (taskQuery.getParentId() == null) {
            spec = spec.and(isMainTask());
        } else if (!taskQuery.getParentId().equals("*")) {
            spec = spec.and(hasParent(taskQuery.getParentId()));
        }

        // Date filtering
        if (taskQuery.getDate() != null) {
            spec = spec.and(hasScheduledDate(taskQuery.getDate()));
        } else if (taskQuery.getPeriod() != null) {
            LocalDate today = LocalDate.now();
            spec = spec.and(switch (taskQuery.getPeriod()) {
                case TODAY -> hasScheduledDate(today);
                case PAST -> scheduledBefore(today);
                case FUTURE -> scheduledAfter(today);
            });
        }

        // Completion status
        if (taskQuery.getCompleted() != null) {
            spec = spec.and(isCompleted(taskQuery.getCompleted()));
        }

        // Importance
        if (taskQuery.getMinImportance() != null) {
            spec = spec.and(hasMinImportance(taskQuery.getMinImportance()));
        }

        // Tag
        if (taskQuery.getTag() != null) {
            spec = spec.and(hasTag(taskQuery.getTag()));
        }

        return spec;
    }
}