package org.osama.session.activity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.activity.ActivityRepository;
import org.osama.activity.ActivityRequest;
import org.osama.activity.ActivityResponse;
import org.osama.activity.ActivityService;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class ActivitySessionServiceTest {
    private static final String USER_ID = "activity-session-user";
    private static final String OTHER_USER_ID = "activity-session-other";
    private static final Instant NINE = Instant.parse("2026-11-18T09:00:00Z");

    @Autowired private ActivitySessionRepository sessionRepository;
    @Autowired private ActivityRepository activityRepository;
    @Autowired private ActivityService activityService;
    @Autowired private UserRepository userRepository;

    private final MovableClock clock = new MovableClock(NINE);
    private ActivitySessionService timers;
    private ActivityResponse leisure;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID));
        userRepository.save(user(OTHER_USER_ID));
        timers = new ActivitySessionService(sessionRepository, activityRepository, userRepository, clock);
        leisure = activityService.createActivity(new ActivityRequest("Leisure", "teal", null), USER_ID);
    }

    // Starting

    @Test
    void aTimerForAnActivityIsNamedAfterItAndRunsUntilStopped() {
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        clock.advance(Duration.ofMinutes(40));

        ActivitySessionResponse current = timers.getCurrent(USER_ID).orElseThrow();

        assertEquals("Leisure", started.title());
        assertEquals(leisure.id(), current.activityId());
        assertEquals(40 * 60, current.elapsedSeconds());
        assertTrue(current.active());
        assertNull(current.targetEndAt());
    }

    @Test
    void aTimerNeedsNoActivity() {
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(null, null, "  Cooking ", null), USER_ID);

        assertEquals("Cooking", started.title());
        assertNull(started.activityId());
    }

    @Test
    void startingANewTimerEndsTheRunningOne() {
        ActivitySessionResponse first = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        clock.advance(Duration.ofMinutes(10));

        ActivitySessionResponse second = timers.start(new StartActivitySessionRequest(null, null, "Reading", null), USER_ID);

        assertEquals(second.id(), timers.getCurrent(USER_ID).orElseThrow().id());
        ActivitySessionResponse ended = timers.end(first.id(), USER_ID);
        assertFalse(ended.active());
        assertEquals(10 * 60, ended.elapsedSeconds());
    }

    @Test
    void anotherUsersActivityCannotBeTimed() {
        ActivityResponse theirs = activityService.createActivity(new ActivityRequest("Focus", "violet", null), OTHER_USER_ID);

        assertThrows(ResourceNotFoundException.class,
                () -> timers.start(new StartActivitySessionRequest(theirs.id(), null, null, null), USER_ID));
    }

    @Test
    void aCountdownMustEndInTheFuture() {
        assertThrows(IllegalArgumentException.class,
                () -> timers.start(new StartActivitySessionRequest(leisure.id(), null, null, NINE.minusSeconds(1)), USER_ID));
    }

    // Pausing

    @Test
    void pausedTimeIsNotCounted() {
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        clock.advance(Duration.ofMinutes(15));
        timers.pause(started.id(), USER_ID);
        clock.advance(Duration.ofMinutes(30));

        assertEquals(15 * 60, timers.getCurrent(USER_ID).orElseThrow().elapsedSeconds());

        timers.resume(started.id(), USER_ID);
        clock.advance(Duration.ofMinutes(5));
        assertEquals(20 * 60, timers.getCurrent(USER_ID).orElseThrow().elapsedSeconds());
    }

    @Test
    void aCountdownFinishesLaterByTheTimeItWasPaused() {
        Instant chunkEnd = NINE.plus(Duration.ofHours(1));
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(leisure.id(), "event-1", null, chunkEnd), USER_ID);
        clock.advance(Duration.ofMinutes(10));
        timers.pause(started.id(), USER_ID);
        clock.advance(Duration.ofMinutes(5));

        ActivitySessionResponse resumed = timers.resume(started.id(), USER_ID);

        assertEquals(chunkEnd.plus(Duration.ofMinutes(5)), resumed.targetEndAt());
        assertEquals("event-1", resumed.eventId());
    }

    @Test
    void stoppingAPausedTimerEndsItWhereItWasPaused() {
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        clock.advance(Duration.ofMinutes(20));
        timers.pause(started.id(), USER_ID);
        clock.advance(Duration.ofHours(2));

        ActivitySessionResponse ended = timers.end(started.id(), USER_ID);

        assertEquals(NINE.plus(Duration.ofMinutes(20)), ended.endedAt());
        assertEquals(20 * 60, ended.elapsedSeconds());
        assertTrue(timers.getCurrent(USER_ID).isEmpty());
    }

    @Test
    void anEndedTimerCannotBePaused() {
        ActivitySessionResponse started = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        timers.end(started.id(), USER_ID);

        assertThrows(IllegalArgumentException.class, () -> timers.pause(started.id(), USER_ID));
    }

    // Reading a day

    @Test
    void aDayListsTheTimersThatOverlapIt() {
        ActivitySessionResponse morning = timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);
        clock.advance(Duration.ofHours(1));
        timers.end(morning.id(), USER_ID);
        clock.advance(Duration.ofDays(1));
        timers.start(new StartActivitySessionRequest(leisure.id(), null, null, null), USER_ID);

        List<ActivitySessionResponse> firstDay = timers.getBetween(USER_ID, NINE.minus(Duration.ofHours(9)), NINE.plus(Duration.ofHours(15)));

        assertEquals(List.of(morning.id()), firstDay.stream().map(ActivitySessionResponse::id).toList());
        assertTrue(timers.getBetween(OTHER_USER_ID, NINE.minus(Duration.ofDays(1)), NINE.plus(Duration.ofDays(3))).isEmpty());
    }

    private static User user(String id) {
        return User.builder().id(id).keycloakId(id + "-keycloak").email(id + "@example.com")
                .firstName("Timer").lastName("Tester").username(id).active(true).build();
    }

    private static final class MovableClock extends Clock {
        private Instant now;

        MovableClock(Instant start) { this.now = start; }

        void advance(Duration duration) { now = now.plus(duration); }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
