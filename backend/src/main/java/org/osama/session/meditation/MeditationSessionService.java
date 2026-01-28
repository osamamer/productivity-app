package org.osama.session.meditation;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
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

    public Optional<MeditationSession> pauseSession(String sessionId) {
        Optional<MeditationSession> runningSession = meditationSessionRepository.findMeditationSessionByIdAndRunningIsTrue(sessionId);
        if (runningSession.isEmpty()) {
            throw new IllegalStateException("Cannot pause a meditation session when it is not running.");
        }
        if (!runningSession.get().getId().equals(sessionId)) {
            throw new IllegalStateException("Cannot pause a meditation session when it is not the one running.");
        }
        MeditationSession session = runningSession.get();
        session.setRunning(false);
        session.setLastPauseTime(LocalDateTime.now());
        addSessionTimeAfterPausing(session);
        log.info("Paused meditation session with ID [{}]", session.getId());
        return Optional.of(meditationSessionRepository.save(session));
    }

    public Optional<MeditationSession> unpauseSession(String sessionId) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot unpause a meditation session when it is not active.");
        }
        if (!activeSession.get().getId().equals(sessionId)) {
            throw new IllegalStateException("Cannot unpause a meditation session when it is not the one active.");
        }
        MeditationSession session = activeSession.get();
        session.setRunning(true);
        session.setLastUnpauseTime(LocalDateTime.now());
        log.info("Unpaused meditation session with ID [{}]", session.getId());
        return Optional.of(meditationSessionRepository.save(session));
    }

    public Optional<MeditationSession> endSession(String sessionId) {
        Optional<MeditationSession> activeSession = meditationSessionRepository.findMeditationSessionByIdAndActiveIsTrue(sessionId);
        if (activeSession.isEmpty()) {
            throw new IllegalStateException("Cannot end a meditation session when it is not active.");
        }
        if (!activeSession.get().getId().equals(sessionId)) {
            throw new IllegalStateException("Cannot end a meditation session when it is not the one active.");
        }
        MeditationSession session = activeSession.get();
        session.setRunning(false);
        session.setActive(false);
        session.setLastPauseTime(LocalDateTime.now());
        session.setEndTime(session.getLastPauseTime());
        addSessionTimeAfterPausing(session);
        log.info("Ended meditation session with ID [{}]", session.getId());
        return Optional.of(meditationSessionRepository.save(session));
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
}
