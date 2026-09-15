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
    @Autowired private CalendarEventCancellationRepository cancellationRepository;
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
        assertEquals(CalendarEventStatus.CONFIRMED, event.status());
        assertEquals(1440, event.reminderMinutesBefore());
        assertEquals(start.minusSeconds(24 * 60 * 60), reminder.getDateTime());
        assertEquals(USER_ID, reminder.getUser().getId());
    }

    @Test
    void eventStatusCanBeTentative() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setStatus(CalendarEventStatus.TENTATIVE);

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertEquals(CalendarEventStatus.TENTATIVE, event.status());
    }

    @Test
    void cancelledEventDoesNotKeepAReminder() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setStatus(CalendarEventStatus.CANCELLED);

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertEquals(CalendarEventStatus.CANCELLED, event.status());
        assertNull(event.reminderMinutesBefore());
        assertTrue(reminderRepository.findByEventId(event.id()).isEmpty());
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
    void updateCreatesANewReminderOccurrenceSoClientsDoNotDeduplicateIt() {
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
        assertNotEquals(reminderId, updated.getReminderId());
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

    @Test
    void recurringEventStoresFrequencyAndOptionalEndDate() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        request.setRecurrenceEndDate(LocalDate.of(2027, 2, 28));

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertEquals(RecurrenceFrequency.WEEKLY, event.recurrenceFrequency());
        assertEquals(LocalDate.of(2027, 2, 28), event.recurrenceEndDate());
    }

    @Test
    void customRecurringEventStoresItsIntervalAndUnit() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.CUSTOM);
        request.setRecurrenceInterval(2);
        request.setRecurrenceUnit(RecurrenceUnit.WEEKS);

        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        assertEquals(RecurrenceFrequency.CUSTOM, event.recurrenceFrequency());
        assertEquals(2, event.recurrenceInterval());
        assertEquals(RecurrenceUnit.WEEKS, event.recurrenceUnit());
    }

    @Test
    void customRecurringEventRequiresAValidIntervalAndUnit() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.CUSTOM);
        request.setRecurrenceInterval(0);

        assertThrows(IllegalArgumentException.class, () -> eventService.createEvent(request, USER_ID));
    }

    @Test
    void cancellingOneRecurringOccurrenceLeavesTheSeriesActiveAndCanBeRestored() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        request.setRecurrenceEndDate(LocalDate.of(2027, 2, 28));
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest occurrence = new CalendarEventOccurrenceRequest();
        occurrence.setOccurrenceKey("instant:2027-01-17T10:00:00.000Z");

        CalendarEventResponse cancelled = eventService.cancelEventOccurrence(event.id(), occurrence, USER_ID);

        assertEquals(CalendarEventStatus.CONFIRMED, cancelled.status());
        assertEquals(1, cancelled.cancelledOccurrenceKeys().size());
        assertEquals("instant:2027-01-17T10:00:00Z", cancelled.cancelledOccurrenceKeys().get(0));
        assertTrue(cancellationRepository.findByEventIdAndOccurrenceKey(
                event.id(), "instant:2027-01-17T10:00:00Z").isPresent());

        CalendarEventResponse restored = eventService.restoreEventOccurrence(
                event.id(), occurrence.getOccurrenceKey(), USER_ID);

        assertTrue(restored.cancelledOccurrenceKeys().isEmpty());
        assertTrue(cancellationRepository.findByEventIdAndOccurrenceKey(
                event.id(), "instant:2027-01-17T10:00:00Z").isEmpty());
    }

    @Test
    void changingOccurrenceStatusDoesNotChangeTheSeriesStatus() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest occurrence = new CalendarEventOccurrenceRequest();
        occurrence.setOccurrenceKey("instant:2027-01-17T10:00:00Z");
        occurrence.setStatus(CalendarEventStatus.TENTATIVE);

        CalendarEventResponse updated = eventService.updateEventOccurrenceStatus(event.id(), occurrence, USER_ID);

        assertEquals(CalendarEventStatus.CONFIRMED, updated.status());
        assertEquals(CalendarEventStatus.TENTATIVE, updated.occurrenceOverrides().get(0).status());
        assertFalse(updated.occurrenceOverrides().get(0).deleted());
    }

    @Test
    void movingOneTimedOccurrenceDoesNotChangeTheSeriesSchedule() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest move = new CalendarEventOccurrenceRequest();
        move.setOccurrenceKey("instant:2027-01-17T10:00:00Z");
        move.setStartTime(Instant.parse("2027-01-18T10:00:00Z"));
        move.setEndTime(Instant.parse("2027-01-18T11:00:00Z"));

        CalendarEventResponse moved = eventService.moveEventOccurrence(event.id(), move, USER_ID);

        assertEquals(Instant.parse("2027-01-10T10:00:00Z"), moved.startTime());
        CalendarEventOccurrenceResponse override = moved.occurrenceOverrides().get(0);
        assertEquals("instant:2027-01-17T10:00:00Z", override.occurrenceKey());
        assertEquals(CalendarEventStatus.CONFIRMED, override.status());
        assertEquals(Instant.parse("2027-01-18T10:00:00Z"), override.startTime());
        assertEquals(Instant.parse("2027-01-18T11:00:00Z"), override.endTime());
        assertNull(override.startDate());
        assertNull(override.endDate());
    }

    @Test
    void movingTheCurrentTimedOccurrenceReschedulesOnlyItsReminder() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest move = new CalendarEventOccurrenceRequest();
        move.setOccurrenceKey("instant:2027-01-10T10:00:00Z");
        move.setStartTime(Instant.parse("2027-01-11T10:00:00Z"));
        move.setEndTime(Instant.parse("2027-01-11T11:00:00Z"));

        eventService.moveEventOccurrence(event.id(), move, USER_ID);

        Reminder reminder = reminderRepository.findByEventId(event.id()).orElseThrow();
        assertEquals(Instant.parse("2027-01-10T10:00:00Z"), reminder.getEventOccurrenceStart());
        assertEquals(Instant.parse("2027-01-11T10:00:00Z").minusSeconds(24 * 60 * 60),
                reminder.getDateTime());
    }

    @Test
    void movingOneAllDayOccurrenceDoesNotChangeTheSeriesSchedule() {
        CalendarEventRequest request = allDayRequest();
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest move = new CalendarEventOccurrenceRequest();
        move.setOccurrenceKey("date:2027-01-17");
        move.setStartDate(LocalDate.of(2027, 1, 19));
        move.setEndDate(LocalDate.of(2027, 1, 19));

        CalendarEventResponse moved = eventService.moveEventOccurrence(event.id(), move, USER_ID);

        assertEquals(LocalDate.of(2027, 1, 10), moved.startDate());
        CalendarEventOccurrenceResponse override = moved.occurrenceOverrides().get(0);
        assertEquals("date:2027-01-17", override.occurrenceKey());
        assertEquals(CalendarEventStatus.CONFIRMED, override.status());
        assertEquals(LocalDate.of(2027, 1, 19), override.startDate());
        assertEquals(LocalDate.of(2027, 1, 19), override.endDate());
        assertNull(override.startTime());
        assertNull(override.endTime());
    }

    @Test
    void deletingOneRecurringOccurrenceHidesOnlyThatOccurrence() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T10:00:00Z"), Instant.parse("2027-01-10T11:00:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.WEEKLY);
        CalendarEventResponse event = eventService.createEvent(request, USER_ID);

        CalendarEventOccurrenceRequest occurrence = new CalendarEventOccurrenceRequest();
        occurrence.setOccurrenceKey("instant:2027-01-17T10:00:00.000Z");
        CalendarEventResponse deleted = eventService.deleteEventOccurrence(event.id(), occurrence, USER_ID);

        assertEquals(CalendarEventStatus.CONFIRMED, deleted.status());
        assertTrue(deleted.occurrenceOverrides().get(0).deleted());
        assertTrue(deleted.cancelledOccurrenceKeys().isEmpty());
    }

    @Test
    void recurringEventRejectsEndDateBeforeItsStartDateInEventTimeZone() {
        CalendarEventRequest request = timedRequest(
                Instant.parse("2027-01-10T00:30:00Z"), Instant.parse("2027-01-10T01:30:00Z"));
        request.setRecurrenceFrequency(RecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(LocalDate.of(2027, 1, 9));

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
