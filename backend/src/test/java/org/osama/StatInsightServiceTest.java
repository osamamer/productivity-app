package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.StatCorrelationResponse;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatInsightService;
import org.osama.stat.StatInsightsResponse;
import org.osama.stat.StatService;
import org.osama.stat.StatType;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class StatInsightServiceTest {

    private static final String TEST_USER_ID = "stat-insight-test-user";

    @Autowired private StatInsightService statInsightService;
    @Autowired private StatService statService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(TEST_USER_ID)
                .email("stat-insight@test.com")
                .firstName("Stat")
                .lastName("Insight")
                .username("statinsight")
                .active(true)
                .build());
    }

    @Test
    void identifiesAUsefulPositiveRelationshipAndExplainsIt() {
        StatDefinition sleep = statService.createDefinition(
                "Sleep", null, StatType.NUMBER, null, null, TEST_USER_ID);
        StatDefinition writing = statService.createDefinition(
                "Writing", null, StatType.NUMBER, null, null, TEST_USER_ID);
        LocalDate start = LocalDate.of(2026, 1, 1);

        for (int day = 0; day < 6; day++) {
            LocalDate date = start.plusDays(day);
            statService.recordEntry(sleep.getId(), date, 4 + day, TEST_USER_ID);
            statService.recordEntry(writing.getId(), date, 1 + day, TEST_USER_ID);
        }

        StatInsightsResponse response = statInsightService.getInsights(
                sleep.getId(), start, start.plusDays(5), TEST_USER_ID);

        assertEquals(6, response.recordedDays());
        StatCorrelationResponse correlation = response.correlations().stream()
                .filter(item -> item.statDefinitionId().equals(writing.getId()))
                .findFirst()
                .orElseThrow();
        assertEquals(6, correlation.overlapDays());
        assertEquals(1.0, correlation.correlation(), 0.0001);
        assertEquals("STRONG", correlation.strength());
        assertEquals("POSITIVE", correlation.direction());
        assertTrue(correlation.meaningful());
        assertEquals(5.0, correlation.otherAverageWhenDriverHigher());
        assertEquals(2.0, correlation.otherAverageWhenDriverLower());
        assertTrue(correlation.insight().contains("On days Sleep was higher, Writing was also higher"));
    }

    @Test
    void doesNotCallAWeakOrUnderSampledRelationshipMeaningful() {
        StatDefinition energy = statService.createDefinition(
                "Energy", null, StatType.NUMBER, null, null, TEST_USER_ID);
        StatDefinition reading = statService.createDefinition(
                "Reading", null, StatType.NUMBER, null, null, TEST_USER_ID);
        LocalDate start = LocalDate.of(2026, 2, 1);

        for (int day = 0; day < 4; day++) {
            LocalDate date = start.plusDays(day);
            statService.recordEntry(energy.getId(), date, day + 1, TEST_USER_ID);
            statService.recordEntry(reading.getId(), date, day % 2, TEST_USER_ID);
        }

        StatInsightsResponse response = statInsightService.getInsights(
                energy.getId(), start, start.plusDays(3), TEST_USER_ID);
        StatCorrelationResponse correlation = response.correlations().get(0);

        assertEquals(4, correlation.overlapDays());
        assertEquals("INSUFFICIENT_DATA", correlation.strength());
        assertFalse(correlation.meaningful());
        assertTrue(correlation.insight().contains("Not enough shared entries yet"));
    }
}
