package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.session.meditation.MeditationSession;
import org.osama.session.meditation.MeditationSessionRepository;
import org.osama.session.meditation.MeditationSessionService;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatEntryRepository;
import org.osama.stat.SystemStatCatalog;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class MeditationSystemStatIntegrationTest {

    private static final String TEST_USER_ID = "meditation-system-stat-user";

    @Autowired private MeditationSessionService meditationSessionService;
    @Autowired private MeditationSessionRepository meditationSessionRepository;
    @Autowired private StatDefinitionRepository definitionRepository;
    @Autowired private StatEntryRepository entryRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(TEST_USER_ID)
                .email("meditation-system-stat@test.com")
                .firstName("Meditation")
                .lastName("Stats")
                .username("meditationsystemstats")
                .active(true)
                .build());
    }

    @Test
    void endingMeditationSessionsMarksTheDayAndAccumulatesMinutes() {
        endSessionWithElapsedMinutes(2);
        MeditationSession secondSession = endSessionWithElapsedMinutes(1);

        StatDefinition meditated = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.MEDITATED_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition meditationMinutes = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY)
                .orElseThrow();

        assertEquals(1.0, entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(
                        meditated.getId(), TEST_USER_ID, secondSession.getEndTime().toLocalDate())
                .orElseThrow()
                .getValue());
        assertEquals(3.0, entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(
                        meditationMinutes.getId(), TEST_USER_ID, secondSession.getEndTime().toLocalDate())
                .orElseThrow()
                .getValue(), 0.05);
    }

    private MeditationSession endSessionWithElapsedMinutes(long minutes) {
        MeditationSession session = meditationSessionService.startSession(5, 0, 0, TEST_USER_ID);
        session.setLastUnpauseTime(LocalDateTime.now().minusMinutes(minutes));
        meditationSessionRepository.save(session);
        return meditationSessionService.endSession(session.getId(), TEST_USER_ID, null);
    }
}
