package org.osama.session.meditation;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.osama.session.events.MeditationSessionEndedEvent;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.osama.constants.MeditationConstants.*;

@Slf4j
@Service
@Transactional
public class MeditationSessionService {
    private final MeditationSessionRepository meditationSessionRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final UserRepository userRepository;

    public MeditationSessionService(MeditationSessionRepository meditationSessionRepository,
                                    ApplicationEventPublisher eventPublisher,
                                    UserRepository userRepository) {
        this.meditationSessionRepository = meditationSessionRepository;
        this.eventPublisher = eventPublisher;
        this.userRepository = userRepository;
    }

    public MeditationSession startSession(int mood, int numIntervalBells, int intendedLength, String userId) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findByUserIdAndActiveIsTrue(userId);
        if (activeSession.isPresent()) {
            throw new IllegalStateException("Cannot start a meditation session when another is already active.");
        }

        validateMood(mood);
        validateNumIntervalBells(numIntervalBells);
        validateIntendedLength(intendedLength);

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        MeditationSession session = createSession();
        session.setStartTime(LocalDateTime.now());
        session.setLastUnpauseTime(session.getStartTime());
        session.setMoodBefore(mood);
        session.setNumIntervalBells(numIntervalBells);
        session.setIntendedLength(intendedLength);
        session.setActive(true);
        session.setRunning(true);
        session.setUser(user);
        MeditationSession savedSession = meditationSessionRepository.save(session);
        log.info("Meditation session started: userId={} sessionId={} moodBefore={} intendedLength={} intervalBells={}",
                userId, savedSession.getId(), mood, intendedLength, numIntervalBells);
        return savedSession;
    }

    public MeditationSession startSession(int mood, int numIntervalBells, String userId) {
        return startSession(mood, numIntervalBells, 0, userId);
    }

    public Optional<MeditationSession> getActiveSession(String userId) {
        return meditationSessionRepository.findByUserIdAndActiveIsTrue(userId);
    }

    public Optional<MeditationSession> getSession(String sessionId, String userId) {
        return meditationSessionRepository.findByIdAndUserId(sessionId, userId);
    }

    public MeditationSession pauseSession(String sessionId, String userId) {
        Optional<MeditationSession> running = userId == null
                ? meditationSessionRepository.findMeditationSessionByIdAndRunningIsTrue(sessionId)
                : meditationSessionRepository.findByIdAndRunningIsTrueAndUserId(sessionId, userId);
        MeditationSession runningSession = running
                .orElseThrow(() -> new IllegalArgumentException("Cannot pause a meditation session when it is not running."));

        LocalDateTime pauseTime = LocalDateTime.now();
        runningSession.setRunning(false);
        runningSession.setLastPauseTime(pauseTime);
        addSessionTimeAfterPausing(runningSession);
        log.info("Meditation session paused: userId={} sessionId={} totalTime={}",
                userId, runningSession.getId(), runningSession.getTotalSessionTime());
        return meditationSessionRepository.save(runningSession);
    }

    public MeditationSession pauseSession(String sessionId) {
        return pauseSession(sessionId, null);
    }

    public MeditationSession unpauseSession(String sessionId, String userId) {
        Optional<MeditationSession> activeSession = userId == null
                ? meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId)
                : meditationSessionRepository.findByIdAndActiveIsTrueAndUserId(sessionId, userId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot unpause a meditation session when it is not active.");
        }

        MeditationSession session = activeSession.get();
        if (session.isRunning()) {
            throw new IllegalStateException("Cannot unpause a meditation session when it is already running.");
        }
        session.setRunning(true);
        session.setLastUnpauseTime(LocalDateTime.now());
        log.info("Meditation session unpaused: userId={} sessionId={}", userId, session.getId());
        return meditationSessionRepository.save(session);
    }

    public MeditationSession unpauseSession(String sessionId) {
        return unpauseSession(sessionId, null);
    }

    public MeditationSession endSession(String sessionId, String userId, Integer moodAfter) {
        Optional<MeditationSession> activeSession = userId == null
                ? meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId)
                : meditationSessionRepository.findByIdAndActiveIsTrueAndUserId(sessionId, userId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot end a meditation session when it is not active.");
        }

        MeditationSession session = activeSession.get();
        LocalDateTime endTime = LocalDateTime.now();
        if (session.isRunning()) {
            session.setLastPauseTime(endTime);
            addSessionTimeAfterPausing(session);
        }
        session.setRunning(false);
        session.setActive(false);
        session.setEndTime(endTime);
        if (moodAfter != null) {
            validateMood(moodAfter);
            session.setMoodAfter(moodAfter);
        }
        log.info("Meditation session ended: userId={} sessionId={} totalTime={} moodAfter={}",
                userId, session.getId(), session.getTotalSessionTime(), moodAfter);
        MeditationSession savedSession = meditationSessionRepository.save(session);
        eventPublisher.publishEvent(new MeditationSessionEndedEvent(
                savedSession.getId(),
                savedSession.getUser().getId(),
                savedSession.getTotalSessionTime(),
                savedSession.getEndTime()
        ));
        return savedSession;
    }

    public MeditationSession endSession(String sessionId) {
        return endSession(sessionId, null, null);
    }

    public MeditationSession createSession() {
        return MeditationSession.builder()
                .id(UUID.randomUUID().toString())
                .active(false)
                .running(false)
                .totalSessionTime(Duration.ZERO)
                .build();
    }

    public void addSessionTimeAfterPausing(MeditationSession session) {
        LocalDateTime lastUnpauseTime = session.getLastUnpauseTime();
        LocalDateTime lastPauseTime = session.getLastPauseTime();
        if (lastUnpauseTime == null || lastPauseTime == null) return;
        Duration addedTime = Duration.between(lastUnpauseTime, lastPauseTime);
        Duration currentTotal = session.getTotalSessionTime() == null ? Duration.ZERO : session.getTotalSessionTime();
        session.setTotalSessionTime(currentTotal.plus(addedTime));
    }

    public void validateMood(int mood) {
        if (mood < MIN_MOOD || mood > MAX_MOOD)
            throw new IllegalArgumentException("Mood must be between 1 and 10, got " + mood);
    }

    public void validateNumIntervalBells(int numBells) {
        if (numBells < 0 || numBells > MAX_BELLS)
            throw new IllegalArgumentException("Number of bells cannot be negative or exceed " + MAX_BELLS);
    }

    public void validateIntendedLength(int intendedLength) {
        if (intendedLength < 0)
            throw new IllegalArgumentException("Intended meditation length cannot be negative");
    }
}
