package org.osama.backup;

import jakarta.persistence.EntityManager;
import jakarta.persistence.metamodel.Attribute;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.DirectFieldAccessor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BackupService {
    private final EntityManager entityManager;

    // Explicit coverage prevents new infrastructure entities (tokens, jobs, credentials) from
    // silently entering device backups. Add new user content here with its ownership predicate.
    private static final List<String> OWNED = List.of(
            "Task", "Project", "Activity", "DayEntity", "DayTemplate", "UserCalendar", "CalendarEvent",
            "TaskSeries", "MentalThread", "MentalCapacityCheckIn", "MentalStateCheckIn",
            "MeditationSession", "ActivitySession", "Pomodoro", "Note", "NoteCategory", "TaskGroup", "StatGroup", "Reminder");
    private static final Set<String> EXCLUDED_FIELDS = Set.of(
            "softDeleted", "user", "userId", "keycloakId", "audioData", "storagePath",
            "sourceUrl", "sourcePayload", "lastError");

    public record Snapshot(int version, Instant capturedAt, Map<String, List<Map<String, Object>>> data) {}

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Snapshot capture(String userId) {
        Map<String, List<Map<String, Object>>> data = new LinkedHashMap<>();
        for (String entity : OWNED) collect(data, entity, "e.user.id = :userId", userId);
        collect(data, "User", "e.id = :userId", userId);
        collect(data, "CalendarSource", "e.userId = :userId", userId);
        collect(data, "PomodoroSound", "e.user.id = :userId", userId);
        collect(data, "StatDefinition", "e.user.id = :userId", userId);
        collect(data, "StatFocusTaskLink", "e.statDefinition.user.id = :userId", userId);
        collect(data, "StatEntry", "e.user.id = :userId", userId);
        collect(data, "StatGroupDefinition", "e.group.user.id = :userId and e.definition.user.id = :userId", userId);
        collect(data, "TaskGroupTask", "e.group.user.id = :userId and e.task.user.id = :userId", userId);
        collect(data, "MentalThreadLoadEntry", "e.mentalThread.user.id = :userId", userId);
        collect(data, "DayTemplateTask", "e.template.user.id = :userId", userId);
        collect(data, "DayTemplateEvent", "e.template.user.id = :userId", userId);
        collect(data, "CalendarEventCancellation", "e.event.user.id = :userId", userId);
        collect(data, "CalendarEventReminderPreference", "e.sourceId in (select s.id from CalendarSource s where s.userId = :userId)", userId);
        collect(data, "TaskSession", "e.associatedTaskId in (select t.taskId from Task t where t.user.id = :userId)", userId);
        return new Snapshot(1, Instant.now(), data);
    }

    private void collect(Map<String, List<Map<String, Object>>> data, String entity, String predicate, String userId) {
        var type = entityManager.getMetamodel().getEntities().stream()
                .filter(candidate -> candidate.getName().equals(entity)).findFirst().orElseThrow();
        var rows = entityManager.createQuery("select e from " + entity + " e where " + predicate, Object.class)
                .setParameter("userId", userId).getResultList();
        data.put(entity, rows.stream().map(row -> {
            Map<String, Object> fields = new LinkedHashMap<>();
            var bean = new DirectFieldAccessor(org.hibernate.Hibernate.unproxy(row));
            type.getAttributes().stream().sorted(java.util.Comparator.comparing(Attribute::getName)).forEach(attribute -> {
                String name = attribute.getName();
                if (EXCLUDED_FIELDS.contains(name) || attribute.isCollection()) return;
                Object value = bean.getPropertyValue(name);
                if (attribute.isAssociation()) {
                    value = value == null ? null : entityManager.getEntityManagerFactory()
                            .getPersistenceUnitUtil().getIdentifier(value);
                    name += "Id";
                }
                fields.put(name, value);
            });
            return fields;
        }).toList());
    }
}
