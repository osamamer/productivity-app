package org.osama.session.meditation;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
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


    public MeditationSessionService(MeditationSessionRepository meditationSessionRepository, ApplicationEventPublisher eventPublisher) {
        this.meditationSessionRepository = meditationSessionRepository;
        this.eventPublisher = eventPublisher;
    }

    public MeditationSession startSession(int mood, int numIntervalBells) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findMeditationSessionByActiveIsTrue();
        if (activeSession.isPresent()) {
            throw new IllegalStateException("Cannot start a meditation session when another is already active.");
        }

        validateMood(mood);
        validateNumIntervalBells(numIntervalBells);

        MeditationSession session = createSession();
        session.setStartTime(LocalDateTime.now());
        session.setLastUnpauseTime(session.getStartTime());
        session.setMoodBefore(mood);
        session.setNumIntervalBells(numIntervalBells);
        session.setActive(true);
        session.setRunning(true);
        log.info("Started a meditation session with ID [{}]", session.getId());
        return meditationSessionRepository.save(session);
    }

    public MeditationSession pauseSession(String sessionId) {
        MeditationSession runningSession = meditationSessionRepository.findMeditationSessionByIdAndRunningIsTrue(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Cannot pause a meditation session when it is not running."));

        runningSession.setRunning(false);
        runningSession.setLastPauseTime(LocalDateTime.now());
        addSessionTimeAfterPausing(runningSession);
        log.info("Paused meditation session with ID [{}]", runningSession.getId());
        return meditationSessionRepository.save(runningSession);
    }

    public MeditationSession unpauseSession(String sessionId) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot unpause a meditation session when it is not active.");
        }

        MeditationSession session = activeSession.get();
        session.setRunning(true);
        session.setLastUnpauseTime(LocalDateTime.now());
        log.info("Unpaused meditation session with ID [{}]", session.getId());
        return meditationSessionRepository.save(session);
    }

    public MeditationSession endSession(String sessionId) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot end a meditation session when it is not active.");
        }

        MeditationSession session = activeSession.get();
        session.setRunning(false);
        session.setActive(false);
        session.setLastPauseTime(LocalDateTime.now());
        session.setEndTime(session.getLastPauseTime());
        addSessionTimeAfterPausing(session);
        log.info("Ended meditation session with ID [{}]", session.getId());
        return meditationSessionRepository.save(session);
    }

    public MeditationSession createSession() {
        return MeditationSession.builder()
                .id(UUID.randomUUID().toString())
                .active(false)
                .running(false)
                .build();
    }

    public void addSessionTimeAfterPausing(MeditationSession session) {
        LocalDateTime lastUnpauseTime = session.getLastUnpauseTime();
        LocalDateTime lastPauseTime = session.getLastPauseTime();
        Duration addedTime = Duration.between(lastUnpauseTime, lastPauseTime);
        session.setTotalSessionTime(session.getTotalSessionTime().plus(addedTime));
    }

    public void validateMood(int mood) {
        if (mood < MIN_MOOD || mood > MAX_MOOD)
            throw new IllegalArgumentException("Mood must be between 1 and 10, got " + mood);
    }

    public void validateNumIntervalBells(int numBells) {
        if (numBells < 0 || numBells > MAX_BELLS)
            throw new IllegalArgumentException("Number of bells cannot be negative or exceed " + MAX_BELLS);
    }
}
