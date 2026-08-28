package org.osama.event;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.reminder.Reminder;
import org.osama.reminder.ReminderRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {DependencyInjectionTestExecutionListener.class, TransactionalTestExecutionListener.class},
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class CalendarEventServiceTest {
    private static final String USER_ID = "calendar-event-user";

    @Autowired private CalendarEventService eventService;
    @Autowired private ReminderRepository reminderRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .keycloakId("calendar-keycloak-user")
                .email("calendar@example.com")
                .firstName("Calendar")
                .lastName("Tester")
                .username("calendar-tester")
                .active(true)
                .build());
    }

    @Test
    void createTimedEventDefaultsReminderToOneDayBefore() {
        Instant start = Instant.parse("2027-01-10T10:00:00Z");
        CalendarEventResponse event = eventService.createEvent(timedRequest(start, start.plusSeconds(3600)), USER_ID);

        Reminder reminder = reminderRepository.findByEventId(event.id()).orElseThrow();
        assertEquals(1440, event.reminderMinutesBefore());
        assertEquals(start.minusSeconds(24 * 60 * 60), reminder.getDateTime());
        assertEquals(USER_ID, reminder.getUser().getId());
    }

    @Test
    void explicitNullReminderCreatesEventWithoutReminder() {
        CalendarEventRequest request = allDayRequest();
        request.setReminderMinutesBefore(null);

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertNull(event.reminderMinutesBefore());
        assertTrue(reminderRepository.findByEventId(event.id()).isEmpty());
    }

    @Test
    void allDayReminderUsesStartOfDayInEventTimeZone() {
        CalendarEventRequest request = allDayRequest();
        request.setReminderMinutesBefore(60);

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertEquals(Instant.parse("2027-01-09T20:00:00Z"),
                reminderRepository.findByEventId(event.id()).orElseThrow().getDateTime());
    }

    @Test
    void updateReschedulesExistingReminderAndMakesItDeliverableAgain() {
        CalendarEventRequest original = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        CalendarEventResponse event = eventService.createEvent(original, USER_ID);
        Reminder reminder = reminderRepository.findByEventId(event.id()).orElseThrow();
        String reminderId = reminder.getReminderId();
        reminder.setDispatchedAt(Instant.now());
        reminder.setAcknowledgedAt(Instant.now());
        reminderRepository.save(reminder);

        CalendarEventRequest changed = timedRequest(
                Instant.parse("2027-01-11T12:00:00Z"), Instant.parse("2027-01-11T13:00:00Z"));
        changed.setReminderMinutesBefore(30);
        eventService.updateEvent(event.id(), changed, USER_ID);

        Reminder updated = reminderRepository.findByEventId(event.id()).orElseThrow();
        assertEquals(reminderId, updated.getReminderId());
        assertEquals(Instant.parse("2027-01-11T11:30:00Z"), updated.getDateTime());
        assertNull(updated.getDispatchedAt());
        assertNull(updated.getAcknowledgedAt());
    }

    @Test
    void timedEventRejectsFinishBeforeStart() {
        Instant start = Instant.parse("2027-01-10T10:00:00Z");
        CalendarEventRequest request = timedRequest(start, start.minusSeconds(1));

        assertThrows(IllegalArgumentException.class, () -> eventService.createEvent(request, USER_ID));
    }

    private CalendarEventRequest timedRequest(Instant start, Instant end) {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle("Doctor appointment");
        request.setDescription("Annual checkup");
        request.setAllDay(false);
        request.setStartTime(start);
        request.setEndTime(end);
        request.setTimeZone("Asia/Amman");
        return request;
    }

    private CalendarEventRequest allDayRequest() {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle("Conference");
        request.setAllDay(true);
        request.setStartDate(LocalDate.of(2027, 1, 10));
        request.setEndDate(LocalDate.of(2027, 1, 10));
        request.setTimeZone("Asia/Amman");
        return request;
    }
}
