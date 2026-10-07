package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.session.meditation.MeditationSession;
import org.osama.session.meditation.MeditationSessionService;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MeditationSessionTest {

    private final MeditationSessionService meditationSessionService =
            new MeditationSessionService(null, null, null);

    @Test
    void newSessionStartsWithNoAccumulatedTime() {
        MeditationSession started = meditationSessionService.createSession();

        assertEquals(Duration.ZERO, started.getTotalSessionTime());
        assertFalse(started.isActive());
        assertFalse(started.isRunning());
    }

    @Test
    void addsOnlyTheRunningIntervalToAccumulatedTime() {
        MeditationSession session = meditationSessionService.createSession();
        session.setLastUnpauseTime(LocalDateTime.of(2026, 1, 1, 10, 0));
        session.setLastPauseTime(LocalDateTime.of(2026, 1, 1, 10, 2));

        meditationSessionService.addSessionTimeAfterPausing(session);

        assertEquals(Duration.ofMinutes(2), session.getTotalSessionTime());
    }

    @Test
    void validatesMeditationConfiguration() {
        assertThrows(IllegalArgumentException.class, () -> meditationSessionService.validateMood(0));
        assertThrows(IllegalArgumentException.class, () -> meditationSessionService.validateNumIntervalBells(11));
        assertThrows(IllegalArgumentException.class, () -> meditationSessionService.validateIntendedLength(-1));
    }
}
