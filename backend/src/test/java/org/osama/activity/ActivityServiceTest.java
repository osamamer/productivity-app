package org.osama.activity;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.event.CalendarEventRequest;
import org.osama.event.CalendarEventResponse;
import org.osama.event.CalendarEventService;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class ActivityServiceTest {
    private static final String USER_ID = "activity-user";
    private static final String OTHER_USER_ID = "activity-other-user";

    @Autowired private ActivityService activityService;
    @Autowired private CalendarEventService eventService;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID));
        userRepository.save(user(OTHER_USER_ID));
    }

    // Activities

    @Test
    void activitiesAreListedInTheirChosenOrder() {
        activityService.createActivity(new ActivityRequest("Leisure", "teal", 1), USER_ID);
        activityService.createActivity(new ActivityRequest("  Focus ", "VIOLET", 0), USER_ID);

        List<ActivityResponse> activities = activityService.getActivities(USER_ID);

        assertEquals(List.of("Focus", "Leisure"), activities.stream().map(ActivityResponse::name).toList());
        assertEquals("violet", activities.get(0).color());
    }

    @Test
    void aNewActivityWithoutAnOrderGoesLast() {
        activityService.createActivity(new ActivityRequest("Focus", "violet", null), USER_ID);
        ActivityResponse rest = activityService.createActivity(new ActivityRequest("Rest", "blue", null), USER_ID);

        assertEquals(1, rest.displayOrder());
    }

    @Test
    void anUpdateOnlyChangesTheFieldsItNames() {
        ActivityResponse focus = activityService.createActivity(new ActivityRequest("Focus", "violet", 0), USER_ID);

        ActivityResponse renamed = activityService.updateActivity(focus.id(), new ActivityRequest("Deep work", null, null), USER_ID);

        assertEquals("Deep work", renamed.name());
        assertEquals("violet", renamed.color());
    }

    @Test
    void namesAndColoursAreValidated() {
        assertThrows(IllegalArgumentException.class,
                () -> activityService.createActivity(new ActivityRequest("  ", "violet", null), USER_ID));
        assertThrows(IllegalArgumentException.class,
                () -> activityService.createActivity(new ActivityRequest("Focus", "#ff0000", null), USER_ID));
    }

    @Test
    void anotherUsersActivityCannotBeChangedOrUsed() {
        ActivityResponse theirs = activityService.createActivity(new ActivityRequest("Focus", "violet", null), OTHER_USER_ID);

        assertThrows(ResourceNotFoundException.class,
                () -> activityService.updateActivity(theirs.id(), new ActivityRequest("Mine", null, null), USER_ID));
        CalendarEventRequest chunk = chunk(theirs.id());
        assertThrows(ResourceNotFoundException.class, () -> eventService.createEvent(chunk, USER_ID));
        assertTrue(activityService.getActivities(USER_ID).isEmpty());
    }

    // Chunks: calendar events with an activity

    @Test
    void aChunkIsACalendarEventThatRemembersItsActivity() {
        ActivityResponse focus = activityService.createActivity(new ActivityRequest("Focus", "violet", null), USER_ID);

        CalendarEventResponse created = eventService.createEvent(chunk(focus.id()), USER_ID);

        assertEquals(focus.id(), created.activityId());
    }

    @Test
    void anUpdateWithoutActivityIdKeepsTheChunksActivity() {
        ActivityResponse focus = activityService.createActivity(new ActivityRequest("Focus", "violet", null), USER_ID);
        CalendarEventResponse created = eventService.createEvent(chunk(focus.id()), USER_ID);

        CalendarEventRequest olderClient = timedRequest("Renamed");
        CalendarEventResponse updated = eventService.updateEvent(created.id(), olderClient, USER_ID);

        assertEquals(focus.id(), updated.activityId());
    }

    @Test
    void sendingABlankActivityTurnsAChunkBackIntoAnOrdinaryEvent() {
        ActivityResponse focus = activityService.createActivity(new ActivityRequest("Focus", "violet", null), USER_ID);
        CalendarEventResponse created = eventService.createEvent(chunk(focus.id()), USER_ID);

        CalendarEventRequest request = timedRequest("Plain event");
        request.setActivityId(null);
        CalendarEventResponse updated = eventService.updateEvent(created.id(), request, USER_ID);

        assertNull(updated.activityId());
    }

    @Test
    void deletingAnActivityKeepsItsChunksOnTheCalendarWithoutIt() {
        ActivityResponse focus = activityService.createActivity(new ActivityRequest("Focus", "violet", null), USER_ID);
        CalendarEventResponse created = eventService.createEvent(chunk(focus.id()), USER_ID);

        activityService.deleteActivity(focus.id(), USER_ID);
        entityManager.flush();
        entityManager.clear();

        CalendarEventResponse kept = eventService.getEvents(USER_ID).stream()
                .filter(event -> event.id().equals(created.id())).findFirst().orElseThrow();
        assertNull(kept.activityId());
        assertTrue(activityService.getActivities(USER_ID).isEmpty());
    }

    private static CalendarEventRequest chunk(String activityId) {
        CalendarEventRequest request = timedRequest("Focus");
        request.setActivityId(activityId);
        return request;
    }

    private static CalendarEventRequest timedRequest(String title) {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle(title);
        request.setTimeZone("UTC");
        request.setStartTime(Instant.parse("2027-01-10T09:00:00Z"));
        request.setEndTime(Instant.parse("2027-01-10T11:00:00Z"));
        return request;
    }

    private static User user(String id) {
        return User.builder()
                .id(id)
                .keycloakId(id + "-keycloak")
                .email(id + "@example.com")
                .firstName("Activity")
                .lastName("Tester")
                .username(id)
                .active(true)
                .build();
    }
}
