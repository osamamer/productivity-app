package org.osama.session.activity;

import lombok.extern.slf4j.Slf4j;
import org.osama.activity.ActivityRepository;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Timers for any activity. At most one runs per user: starting a new one ends the current one. */
@Slf4j
@Service
public class ActivitySessionService {
    private final ActivitySessionRepository sessionRepository;
    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    @Autowired
    public ActivitySessionService(ActivitySessionRepository sessionRepository, ActivityRepository activityRepository,
                                  UserRepository userRepository) {
        this(sessionRepository, activityRepository, userRepository, Clock.systemUTC());
    }

    // Tests pass a clock they can move forward.
    ActivitySessionService(ActivitySessionRepository sessionRepository, ActivityRepository activityRepository,
                           UserRepository userRepository, Clock clock) {
        this.sessionRepository = sessionRepository;
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ActivitySessionResponse> getCurrent(String userId) {
        Instant now = clock.instant();
        return sessionRepository.findFirstByUserIdAndEndedAtIsNullOrderByStartedAtDesc(userId)
                .map(session -> ActivitySessionResponse.from(session, now));
    }

    @Transactional(readOnly = true)
    public List<ActivitySessionResponse> getBetween(String userId, Instant from, Instant to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw new IllegalArgumentException("A time range needs an end after its start.");
        }
        Instant now = clock.instant();
        return sessionRepository.findOverlapping(userId, from, to).stream()
                .map(session -> ActivitySessionResponse.from(session, now))
                .toList();
    }

    @Transactional
    public ActivitySessionResponse start(StartActivitySessionRequest request, String userId) {
        Instant now = clock.instant();
        User user = userRepository.findUserByIdForUpdate(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        sessionRepository.findFirstByUserIdAndEndedAtIsNullOrderByStartedAtDesc(userId)
                .ifPresent(current -> finish(current, now));

        String activityName = null;
        if (request.activityId() != null && !request.activityId().isBlank()) {
            activityName = activityRepository.findByIdAndUserId(request.activityId(), userId)
                    .orElseThrow(() -> new ResourceNotFoundException("Activity not found: " + request.activityId()))
                    .getName();
        }
        String title = request.title() == null || request.title().isBlank()
                ? (activityName == null ? "Timer" : activityName)
                : request.title().trim();
        if (title.length() > 200) throw new IllegalArgumentException("A timer name must be 200 characters or fewer.");
        if (request.targetEndAt() != null && !request.targetEndAt().isAfter(now)) {
            throw new IllegalArgumentException("A countdown needs to end in the future.");
        }

        ActivitySession session = new ActivitySession();
        session.setId(UUID.randomUUID().toString());
        session.setUser(user);
        session.setActivityId(activityName == null ? null : request.activityId());
        session.setEventId(blankToNull(request.eventId()));
        session.setTitle(title);
        session.setStartedAt(now);
        session.setTargetEndAt(request.targetEndAt());
        ActivitySession saved = sessionRepository.save(session);
        log.info("Activity session started: userId={} sessionId={} activityId={} countdown={}",
                userId, saved.getId(), saved.getActivityId(), saved.getTargetEndAt() != null);
        return ActivitySessionResponse.from(saved, now);
    }

    @Transactional
    public ActivitySessionResponse pause(String sessionId, String userId) {
        Instant now = clock.instant();
        ActivitySession session = findActive(sessionId, userId);
        if (session.getPausedAt() == null) session.setPausedAt(now);
        return ActivitySessionResponse.from(session, now);
    }

    @Transactional
    public ActivitySessionResponse resume(String sessionId, String userId) {
        Instant now = clock.instant();
        ActivitySession session = findActive(sessionId, userId);
        if (session.getPausedAt() != null) {
            long pausedFor = Duration.between(session.getPausedAt(), now).toMillis();
            session.setPausedMillis(session.getPausedMillis() + pausedFor);
            // A countdown does not run while paused, so its finish moves back by the pause.
            if (session.getTargetEndAt() != null) session.setTargetEndAt(session.getTargetEndAt().plusMillis(pausedFor));
            session.setPausedAt(null);
        }
        return ActivitySessionResponse.from(session, now);
    }

    @Transactional
    public ActivitySessionResponse end(String sessionId, String userId) {
        Instant now = clock.instant();
        ActivitySession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Timer not found: " + sessionId));
        if (session.isActive()) finish(session, now);
        return ActivitySessionResponse.from(session, now);
    }

    @Transactional
    public void delete(String sessionId, String userId) {
        ActivitySession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Timer not found: " + sessionId));
        sessionRepository.delete(session);
        log.info("Activity session deleted: userId={} sessionId={}", userId, sessionId);
    }

    private void finish(ActivitySession session, Instant now) {
        // A paused timer ends where it was paused; the pause is not counted.
        Instant end = session.getPausedAt() != null ? session.getPausedAt() : now;
        session.setEndedAt(end);
        session.setPausedAt(null);
        log.info("Activity session ended: sessionId={} seconds={}", session.getId(), session.elapsed(now).toSeconds());
    }

    private ActivitySession findActive(String sessionId, String userId) {
        ActivitySession session = sessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Timer not found: " + sessionId));
        if (!session.isActive()) throw new IllegalArgumentException("That timer has already ended.");
        return session;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
