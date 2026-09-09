package org.osama.daytemplate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.day.DayRepository;
import org.osama.event.CalendarEventRepository;
import org.osama.event.CalendarEventStatus;
import org.osama.reminder.ReminderRepository;
import org.osama.task.TaskRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class DayTemplateServiceTest {
    private static final String USER_ID = "day-template-user";
    private static final String OTHER_USER_ID = "other-day-template-user";

    @Autowired private DayTemplateService templateService;
    @Autowired private DayRepository dayRepository;
    @Autowired private CalendarEventRepository eventRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private ReminderRepository reminderRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID, "template@example.com"));
        userRepository.save(user(OTHER_USER_ID, "other-template@example.com"));
    }

    @Test
    void applyingTemplateCreatesTheDayEventsTasksAndReminder() {
        DayTemplateResponse template = templateService.createTemplate(templateRequest(), USER_ID);

        DayTemplateApplicationResponse applied = templateService.applyTemplate(
                template.id(), LocalDate.of(2027, 1, 15), USER_ID);

        assertEquals(LocalDate.of(2027, 1, 15), applied.date());
        assertEquals(1, applied.events().size());
        assertEquals(2, applied.tasks().size());
        assertNotNull(dayRepository.findDayEntityByLocalDateAndUserId(applied.date(), USER_ID).orElse(null));

        var event = eventRepository.findById(applied.events().get(0).id()).orElseThrow();
        assertEquals(LocalDate.of(2027, 1, 15), event.getStartTime().atZone(java.time.ZoneOffset.UTC).toLocalDate());
        assertEquals(CalendarEventStatus.TENTATIVE, event.getStatus());
        assertEquals(30, reminderRepository.findByEventId(event.getId()).orElseThrow().getMinutesBefore());

        assertEquals(LocalDate.of(2027, 1, 15), applied.tasks().get(0).getScheduledPerformDateTime().toLocalDate());
        assertEquals(LocalTime.of(8, 30), applied.tasks().get(0).getScheduledPerformDateTime().toLocalTime());
        assertEquals(LocalDate.of(2027, 1, 15), applied.tasks().get(1).getScheduledPerformDateTime().toLocalDate());
        assertEquals(List.of("Review inbox", "Read book"), taskRepository
                .findAllByUserIdAndParentIdIsNullOrderByDisplayOrderAsc(USER_ID).stream()
                .map(org.osama.task.Task::getName)
                .toList());
    }

    @Test
    void templateItemsAreReturnedInTheirConfiguredOrder() {
        DayTemplateResponse template = templateService.createTemplate(templateRequest(), USER_ID);

        DayTemplateResponse loaded = templateService.getTemplate(template.id(), USER_ID);

        assertEquals(List.of("Morning planning"), loaded.events().stream().map(DayTemplateEventResponse::title).toList());
        assertEquals(List.of("Review inbox", "Read book"), loaded.tasks().stream()
                .map(DayTemplateTaskResponse::name).toList());
    }

    @Test
    void userCannotReadAnotherUsersTemplate() {
        DayTemplateResponse template = templateService.createTemplate(templateRequest(), USER_ID);

        assertThrows(RuntimeException.class, () -> templateService.getTemplate(template.id(), OTHER_USER_ID));
    }

    @Test
    void emptyTemplateMustBeRejected() {
        DayTemplateRequest emptyTemplate = new DayTemplateRequest("Empty", List.of(), List.of());

        assertThrows(IllegalArgumentException.class,
                () -> templateService.createTemplate(emptyTemplate, USER_ID));
    }

    private DayTemplateRequest templateRequest() {
        return new DayTemplateRequest(
                "Workday",
                List.of(new DayTemplateEventRequest(
                        "Morning planning", "Set priorities", false,
                        LocalTime.of(8, 0), LocalTime.of(8, 30), "UTC", 30, CalendarEventStatus.TENTATIVE)),
                List.of(
                        new DayTemplateTaskRequest("Review inbox", "", LocalTime.of(8, 30), "admin", 3),
                        new DayTemplateTaskRequest("Read book", null, null, null, 1))
        );
    }

    private User user(String id, String email) {
        return User.builder()
                .id(id)
                .keycloakId(id + "-keycloak")
                .email(email)
                .firstName("Template")
                .lastName("Tester")
                .username(id)
                .active(true)
                .build();
    }
}
