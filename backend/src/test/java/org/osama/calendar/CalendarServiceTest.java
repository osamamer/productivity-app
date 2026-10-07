package org.osama.calendar;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.daytemplate.DayTemplateEventRequest;
import org.osama.daytemplate.DayTemplateRequest;
import org.osama.daytemplate.DayTemplateResponse;
import org.osama.daytemplate.DayTemplateService;
import org.osama.daytemplate.DayTemplateTaskRequest;
import org.osama.event.CalendarEventRequest;
import org.osama.event.CalendarEventResponse;
import org.osama.event.CalendarEventService;
import org.osama.event.CalendarEventStatus;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.task.recurrence.TaskRecurrenceFrequency;
import org.osama.task.recurrence.TaskSeries;
import org.osama.task.recurrence.TaskSeriesRepository;
import org.osama.task.recurrence.TaskSeriesService;
import org.osama.task.recurrence.TaskSeriesUpdateRequest;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.osama.user.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {DependencyInjectionTestExecutionListener.class, TransactionalTestExecutionListener.class},
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class CalendarServiceTest {
    @Autowired private CalendarService calendarService;
    @Autowired private CalendarRepository calendarRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private UserService userService;
    @Autowired private TaskService taskService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskSeriesService taskSeriesService;
    @Autowired private TaskSeriesRepository taskSeriesRepository;
    @Autowired private CalendarEventService eventService;
    @Autowired private DayTemplateService dayTemplateService;
    @Autowired private jakarta.persistence.EntityManager entityManager;

    private String userId;
    private String otherUserId;

    @BeforeEach
    void setUp() {
        userId = "calendar-user-" + UUID.randomUUID();
        otherUserId = "calendar-other-user-" + UUID.randomUUID();
        userRepository.save(user(userId, "calendar-owner"));
        userRepository.save(user(otherUserId, "calendar-other"));
    }

    @Test
    void newUserAndOmittedItemAssignmentsReceiveTheProtectedDefaultCalendar() {
        String newUserId = userService.createUser(
                "calendar-new-" + UUID.randomUUID() + "@example.com", "New", "User",
                "calendar-new-" + UUID.randomUUID(), "calendar-new-keycloak-" + UUID.randomUUID()).getId();
        CalendarResponse provisioned = calendarService.getCalendars(newUserId).getFirst();
        assertTrue(provisioned.defaultCalendar());
        assertTrue(provisioned.visible());

        String defaultCalendarId = calendarService.defaultCalendarId(userId);
        Task task = taskService.createTask(taskRequest("Default task"), userId);
        CalendarEventResponse event = eventService.createEvent(allDayEventRequest(), userId);

        assertEquals(defaultCalendarId, task.getCalendarId());
        assertEquals(defaultCalendarId, event.calendarId());
    }

    @Test
    void updatingAnItemWithoutCalendarIdPreservesItsCalendar() {
        String calendarId = calendarService.createCalendar(
                new CreateCalendarRequest("Side projects", "purple"), userId).id();
        NewTaskRequest createTask = taskRequest("Assigned task");
        createTask.setCalendarId(calendarId);
        Task task = taskService.createTask(createTask, userId);
        UpdateTaskRequest taskUpdate = new UpdateTaskRequest();
        taskUpdate.setName("Renamed task");
        Task updatedTask = taskService.updateTask(task.getTaskId(), taskUpdate, userId).orElseThrow();

        CalendarEventRequest createEvent = allDayEventRequest();
        createEvent.setCalendarId(calendarId);
        CalendarEventResponse event = eventService.createEvent(createEvent, userId);
        CalendarEventResponse updatedEvent = eventService.updateEvent(event.id(), allDayEventRequest(), userId);

        assertEquals(calendarId, updatedTask.getCalendarId());
        assertEquals(calendarId, updatedEvent.calendarId());
    }

    @Test
    void assignmentsToAnotherUsersCalendarAreRejectedForTasksEventsAndTemplates() {
        String foreignCalendarId = calendarService.createCalendar(
                new CreateCalendarRequest("Private", "red"), otherUserId).id();

        NewTaskRequest task = taskRequest("Invalid task");
        task.setCalendarId(foreignCalendarId);
        assertThrows(ResourceNotFoundException.class, () -> taskService.createTask(task, userId));

        CalendarEventRequest event = allDayEventRequest();
        event.setCalendarId(foreignCalendarId);
        assertThrows(ResourceNotFoundException.class, () -> eventService.createEvent(event, userId));

        DayTemplateTaskRequest templateTask = new DayTemplateTaskRequest(
                "Invalid template task", "", LocalTime.NOON, null, 3, foreignCalendarId);
        DayTemplateRequest template = new DayTemplateRequest("Invalid", null, List.of(templateTask));
        assertThrows(ResourceNotFoundException.class, () -> dayTemplateService.createTemplate(template, userId));

        DayTemplateEventRequest templateEvent = new DayTemplateEventRequest(
                "Invalid template event", "", true, null, null, "UTC", null,
                CalendarEventStatus.CONFIRMED, foreignCalendarId);
        assertThrows(ResourceNotFoundException.class, () -> dayTemplateService.createTemplate(
                new DayTemplateRequest("Invalid event template", List.of(templateEvent), null), userId));

        NewTaskRequest recurringTask = taskRequest("Invalid series assignment");
        recurringTask.setScheduledPerformDateTime(LocalDateTime.now().plusDays(1).withNano(0).toString());
        recurringTask.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        recurringTask.setRecurrenceEndDate(LocalDate.now().plusDays(2));
        Task firstOccurrence = taskSeriesService.createSeries(recurringTask, userId);
        TaskSeriesUpdateRequest seriesUpdate = new TaskSeriesUpdateRequest();
        seriesUpdate.setCalendarId(foreignCalendarId);
        assertThrows(ResourceNotFoundException.class, () -> taskSeriesService.updateSeries(
                firstOccurrence.getTaskSeriesId(), seriesUpdate, userId));
    }

    @Test
    void movingOneRecurringTaskMovesTheSeriesAndAllOccurrences() {
        String firstCalendar = calendarService.createCalendar(
                new CreateCalendarRequest("First", "blue"), userId).id();
        String secondCalendar = calendarService.createCalendar(
                new CreateCalendarRequest("Second", "green"), userId).id();
        NewTaskRequest request = taskRequest("Repeating task");
        request.setCalendarId(firstCalendar);
        request.setScheduledPerformDateTime(LocalDateTime.now().plusDays(1).withNano(0).toString());
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(LocalDate.now().plusDays(3));

        Task firstOccurrence = taskSeriesService.createSeries(request, userId);
        Task deletedOccurrence = taskRepository.findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(
                firstOccurrence.getTaskSeriesId(), userId).get(1);
        taskRepository.delete(deletedOccurrence);
        taskRepository.flush();
        UpdateTaskRequest move = new UpdateTaskRequest();
        move.setCalendarId(secondCalendar);
        taskService.updateTask(firstOccurrence.getTaskId(), move, userId).orElseThrow();

        TaskSeries series = taskSeriesRepository.findBySeriesIdAndUserId(firstOccurrence.getTaskSeriesId(), userId)
                .orElseThrow();
        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdAndUserIdOrderBySeriesOccurrenceAtAsc(
                firstOccurrence.getTaskSeriesId(), userId);
        assertEquals(secondCalendar, series.getCalendarId());
        assertFalse(occurrences.isEmpty());
        assertTrue(occurrences.stream().allMatch(task -> secondCalendar.equals(task.getCalendarId())));
        String deletedOccurrenceCalendar = (String) entityManager.createNativeQuery(
                        "select calendar_id from task where task_id = :taskId")
                .setParameter("taskId", deletedOccurrence.getTaskId())
                .getSingleResult();
        assertEquals(secondCalendar, deletedOccurrenceCalendar);
    }

    @Test
    void deletingCalendarLeavesItsTasksAttachedAndOnlySoftDeletesTheCalendar() {
        String calendarId = calendarService.createCalendar(
                new CreateCalendarRequest("Archive", "orange"), userId).id();
        NewTaskRequest request = taskRequest("Still available task");
        request.setCalendarId(calendarId);
        Task task = taskService.createTask(request, userId);
        CalendarEventRequest eventRequest = allDayEventRequest();
        eventRequest.setCalendarId(calendarId);
        CalendarEventResponse event = eventService.createEvent(eventRequest, userId);

        calendarService.deleteCalendar(calendarId, userId);

        Task stillAvailable = taskRepository.findTaskByTaskIdAndUserId(task.getTaskId(), userId).orElseThrow();
        CalendarEventResponse stillAvailableEvent = eventService.getEvents(userId).stream()
                .filter(candidate -> candidate.id().equals(event.id()))
                .findFirst().orElseThrow();
        Boolean softDeleted = (Boolean) entityManager.createNativeQuery(
                        "select soft_deleted from app_calendar where calendar_id = :calendarId")
                .setParameter("calendarId", calendarId)
                .getSingleResult();
        assertEquals(calendarId, stillAvailable.getCalendarId());
        assertEquals(calendarId, stillAvailableEvent.calendarId());
        assertTrue(softDeleted);
        assertFalse(calendarService.isActiveOwnedCalendar(calendarId, userId));
    }

    @Test
    void deletedTemplateCalendarsFallBackToDefaultWithoutChangingTheTemplate() {
        String calendarId = calendarService.createCalendar(
                new CreateCalendarRequest("Early routine", "teal"), userId).id();
        DayTemplateTaskRequest templateTask = new DayTemplateTaskRequest(
                "Template task", "", LocalTime.NOON, null, 3, calendarId);
        DayTemplateEventRequest templateEvent = new DayTemplateEventRequest(
                "Template event", "", true, null, null, "UTC", null,
                CalendarEventStatus.CONFIRMED, calendarId);
        DayTemplateResponse template = dayTemplateService.createTemplate(
                new DayTemplateRequest("Mixed calendar routine", List.of(templateEvent), List.of(templateTask)), userId);
        calendarService.deleteCalendar(calendarId, userId);

        var applied = dayTemplateService.applyTemplate(template.id(), LocalDate.now().plusDays(7), userId);
        String defaultCalendarId = calendarService.defaultCalendarId(userId);
        DayTemplateResponse unchanged = dayTemplateService.getTemplate(template.id(), userId);

        assertEquals(defaultCalendarId, applied.tasks().getFirst().getCalendarId());
        assertEquals(defaultCalendarId, applied.events().getFirst().calendarId());
        assertEquals(calendarId, unchanged.tasks().getFirst().calendarId());
        assertEquals(calendarId, unchanged.events().getFirst().calendarId());
    }

    @Test
    void defaultCalendarCanBeCustomizedAndHiddenButNotDeleted() {
        CalendarResponse defaultCalendar = calendarService.getCalendars(userId).getFirst();
        CalendarResponse customized = calendarService.updateCalendar(defaultCalendar.id(),
                new UpdateCalendarRequest("Personal", "purple", null, false), userId);

        assertTrue(customized.defaultCalendar());
        assertEquals("Personal", customized.name());
        assertEquals("purple", customized.color());
        assertFalse(customized.visible());
        assertThrows(IllegalArgumentException.class, () -> calendarService.deleteCalendar(defaultCalendar.id(), userId));
    }

    private User user(String id, String username) {
        return User.builder()
                .id(id)
                .keycloakId("keycloak-" + id)
                .email(id + "@example.com")
                .firstName("Calendar")
                .lastName("Tester")
                .username(username + "-" + id)
                .active(true)
                .build();
    }

    private NewTaskRequest taskRequest(String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setReminderMinutesBefore(null);
        return request;
    }

    private CalendarEventRequest allDayEventRequest() {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle("Calendar event");
        request.setAllDay(true);
        request.setStartDate(LocalDate.now().plusDays(10));
        request.setEndDate(LocalDate.now().plusDays(10));
        request.setTimeZone("UTC");
        request.setReminderMinutesBefore(null);
        return request;
    }
}
