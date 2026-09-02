package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.*;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
public class StatServiceTest {

    private static final String TEST_USER_ID = "stat-test-user";

    @Autowired private StatService statService;
    @Autowired private StatEntryRepository entryRepository;
    @Autowired private StatDefinitionRepository definitionRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private SystemStatProvisioningService provisioningService;

    @BeforeEach
    void setUp() {
        User testUser = User.builder()
                .id(TEST_USER_ID)
                .email("stat@test.com")
                .firstName("Stat")
                .lastName("Tester")
                .username("stattester")
                .active(true)
                .build();
        userRepository.save(testUser);
    }

    // --- BOOLEAN ---

    @Test
    void booleanStat_acceptsZero() {
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);
        StatEntry entry = statService.recordEntry(statDefinition.getId(), LocalDate.now(), 0.0, TEST_USER_ID);
        assertEquals(0.0, entry.getValue());
  }

    @Test
    void booleanStat_acceptsOne() {
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);
        StatEntry entry = statService.recordEntry(statDefinition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        assertEquals(1.0, entry.getValue());
    }

    @Test
    void booleanStat_rejectsNonBinaryValue() {
        // Create definition first, THEN assert throws on the entry call only
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);

        // The exception here taints the transaction — wrap in assertThrows cleanly
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), 0.6, TEST_USER_ID));
    }

    // --- RANGE ---

    @Test
    void rangeStat_acceptsValueWithinBounds() {
        StatDefinition statDefinition = createStatDefinition(StatType.RANGE, 1.0, 10.0);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 6.0, TEST_USER_ID);
        StatEntry statEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinition.getId(), TEST_USER_ID, LocalDate.now())
                .orElseThrow();
        assertEquals(6.0, statEntry.getValue());
    }

    @Test
    void rangeStat_acceptsBoundaryValues() {
        StatDefinition statDefinition = createStatDefinition(StatType.RANGE, 1.0, 10.0);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), LocalDate.now().plusDays(1), 10.0, TEST_USER_ID);

        StatEntry statEntryMin = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinition.getId(), TEST_USER_ID, LocalDate.now())
                .orElseThrow();
        StatEntry statEntryMax = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinition.getId(), TEST_USER_ID, LocalDate.now().plusDays(1))
                .orElseThrow();
        assertEquals(1.0, statEntryMin.getValue());
        assertEquals(10.0, statEntryMax.getValue());

    }

    @Test
    void rangeStat_rejectsValueAboveMax() {
        StatDefinition statDefinition = createStatDefinition(StatType.RANGE, 1.0, 10.0);
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), 11.0, TEST_USER_ID));
    }

    @Test
    void rangeStat_rejectsValueBelowMin() {
        StatDefinition statDefinition = createStatDefinition(StatType.RANGE, 1.0, 10.0);
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), 0.0, TEST_USER_ID));
    }

    // --- NUMBER ---

    @Test
    void numberStat_acceptsAnyDouble() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), -999999.99, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), LocalDate.now().plusDays(1), 999999.99, TEST_USER_ID);
    }

    @Test
    void meditationStats_rejectManualEntries() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);

        for (String systemKey : List.of(
                SystemStatCatalog.MEDITATED_SYSTEM_KEY,
                SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY)) {
            StatDefinition definition = definitionRepository
                    .findByUserIdAndSystemKey(TEST_USER_ID, systemKey)
                    .orElseThrow();

            assertThrows(IllegalArgumentException.class, () ->
                    statService.recordEntry(definition.getId(), LocalDate.now(), 1.0, TEST_USER_ID));
        }
    }

    @Test
    void definitionDefaultsToNeutralWithoutThreshold() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);

        assertNull(statDefinition.getMorality());
        assertNull(statDefinition.getGoodThreshold());
    }

    @Test
    void goodBooleanDefinitionStoresMoralityWithoutThreshold() {
        StatDefinition statDefinition = statService.createDefinition(
                "Good habit", null, StatType.BOOLEAN, null, null,
                StatMorality.GOOD, null, TEST_USER_ID);

        assertEquals(StatMorality.GOOD, statDefinition.getMorality());
        assertNull(statDefinition.getGoodThreshold());
    }

    @Test
    void badBooleanDefinitionRejectsThreshold() {
        assertThrows(IllegalArgumentException.class, () -> statService.createDefinition(
                "Bad habit", null, StatType.BOOLEAN, null, null,
                StatMorality.BAD, 1.0, TEST_USER_ID));
    }

    @Test
    void nonNeutralNumericDefinitionRequiresThreshold() {
        assertThrows(IllegalArgumentException.class, () -> statService.createDefinition(
                "Exercise", null, StatType.NUMBER, null, null,
                StatMorality.GOOD, null, TEST_USER_ID));
    }

    @Test
    void rangeDefinitionRequiresThresholdInsideRange() {
        assertThrows(IllegalArgumentException.class, () -> statService.createDefinition(
                "Pain", null, StatType.RANGE, 1.0, 10.0,
                StatMorality.BAD, 11.0, TEST_USER_ID));

        StatDefinition statDefinition = statService.createDefinition(
                "Pain", null, StatType.RANGE, 1.0, 10.0,
                StatMorality.BAD, 4.0, TEST_USER_ID);
        assertEquals(StatMorality.BAD, statDefinition.getMorality());
        assertEquals(4.0, statDefinition.getGoodThreshold());
    }

    @Test
    void definitionCanUpdateMoralityAndThreshold() {
        StatDefinition statDefinition = createNamedStatDefinition("Quiet time", StatType.NUMBER);

        StatDefinition updated = statService.updateDefinition(
                statDefinition.getId(), "Quiet time", "Less noise is better",
                StatMorality.BAD, 30.0, TEST_USER_ID);

        assertEquals(StatMorality.BAD, updated.getMorality());
        assertEquals(30.0, updated.getGoodThreshold());
        assertEquals("Less noise is better", updated.getDescription());
    }

    @Test
    void definitionUpdateAllowsKeepingItsOwnName() {
        StatDefinition statDefinition = createNamedStatDefinition("Keep this name", StatType.BOOLEAN);

        StatDefinition updated = statService.updateDefinition(
                statDefinition.getId(), "Keep this name", null,
                StatMorality.GOOD, null, TEST_USER_ID);

        assertEquals(StatMorality.GOOD, updated.getMorality());
    }

    @Test
    void definitionUpdateRejectsDuplicateStatName() {
        createNamedStatDefinition("Already used", StatType.BOOLEAN);
        StatDefinition other = createNamedStatDefinition("Other", StatType.BOOLEAN);

        assertThrows(IllegalArgumentException.class, () -> statService.updateDefinition(
                other.getId(), "Already used", null,
                StatMorality.BAD, null, TEST_USER_ID));
    }

    // --- Upsert behaviour ---

    @Test
    void recordEntry_updatesExistingEntryForSameDay() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 2.0, TEST_USER_ID);

        var entries = entryRepository.findAllByUserIdAndDate(TEST_USER_ID, LocalDate.now());
        assertEquals(1, entries.size());
        assertEquals(2.0, entries.get(0).getValue());
    }

    @Test
    void recordEntry_createsSeparateEntriesForDifferentDays() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), LocalDate.now().minusDays(1), 2.0, TEST_USER_ID);

        var today = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinition.getId(), TEST_USER_ID, LocalDate.now()).orElseThrow();
        var yesterday = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinition.getId(), TEST_USER_ID, LocalDate.now().minusDays(1)).orElseThrow();
        assertEquals(1.0, today.getValue());
        assertEquals(2.0, yesterday.getValue());
    }

    // --- Definition validation ---

    @Test
    void createRangeDefinition_rejectsNullMin() {
        assertThrows(IllegalArgumentException.class, () ->
                createStatDefinition(StatType.RANGE, null, 10.0));
    }

    @Test
    void createRangeDefinition_rejectsMinGreaterThanMax() {
        assertThrows(IllegalArgumentException.class, () ->
                createStatDefinition(StatType.RANGE, 10.0, 1.0));
    }

    // --- Value round-trip ---

    @Test
    void recordedValueIsReturnedCorrectly() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 42.5, TEST_USER_ID);

        var entries = statService.getEntries(statDefinition.getId(), LocalDate.now(), LocalDate.now(), TEST_USER_ID);
        assertEquals(1, entries.size());
        assertEquals(42.5, entries.get(0).getValue());
    }

    // --- Timeframe summaries ---

    @Test
    void numericSummaryUsesRequestedPeriodForAverageAndTotal() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today.minusDays(2), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(1), 2.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today, 10.0, TEST_USER_ID);

        StatSummaryResponse summary = statService.getSummary(
                statDefinition.getId(), today.minusDays(1), today, TEST_USER_ID);

        assertEquals(2, summary.checkInStreak());
        assertNull(summary.periodYesCount());
        assertEquals(6.0, summary.periodAverage(), 0.0001);
        assertEquals(12.0, summary.periodTotal(), 0.0001);
        assertEquals(10.0, summary.periodHighest(), 0.0001);
    }

    @Test
    void numericSummaryCanIncludeUnloggedDaysAsZeroWhenPreferenceIsEnabled() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today.minusDays(2), 2.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today, 4.0, TEST_USER_ID);

        StatSummaryResponse loggedDaysOnly = statService.getSummary(
                statDefinition.getId(), today.minusDays(2), today, TEST_USER_ID);
        assertEquals(3.0, loggedDaysOnly.periodAverage(), 0.0001);

        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        user.setIncludeUnloggedNumericDaysAsZero(true);
        userRepository.save(user);

        StatSummaryResponse includingUnloggedDays = statService.getSummary(
                statDefinition.getId(), today.minusDays(2), today, TEST_USER_ID);

        assertEquals(2.0, includingUnloggedDays.periodAverage(), 0.0001);
        assertEquals(6.0, includingUnloggedDays.periodTotal(), 0.0001);
    }

    @Test
    void booleanSummaryCountsAndBoundsStreaksToRequestedPeriod() {
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today.minusDays(2), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(1), 0.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today, 1.0, TEST_USER_ID);

        StatSummaryResponse summary = statService.getSummary(
                statDefinition.getId(), today.minusDays(1), today, TEST_USER_ID);

        assertEquals(2, summary.checkInStreak());
        assertEquals(1, summary.periodYesCount());
        assertEquals(1, summary.booleanStreak());
        assertEquals(1, summary.longestBooleanStreak());
        assertNull(summary.periodAverage());
        assertNull(summary.periodTotal());
    }

    @Test
    void booleanSummaryReportsLongestYesStreakWithinRequestedPeriod() {
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today.minusDays(5), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(4), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(3), 0.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(2), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today.minusDays(1), 1.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today, 1.0, TEST_USER_ID);

        StatSummaryResponse summary = statService.getSummary(
                statDefinition.getId(), today.minusDays(5), today, TEST_USER_ID);

        assertEquals(5, summary.periodYesCount());
        assertEquals(3, summary.booleanStreak());
        assertEquals(3, summary.longestBooleanStreak());
    }

    @Test
    void definitionsCanBeReorderedAndOrderIsReturnedPersistently() {
        StatDefinition first = createNamedStatDefinition("First", StatType.NUMBER);
        StatDefinition second = createNamedStatDefinition("Second", StatType.BOOLEAN);
        StatDefinition third = createNamedStatDefinition("Third", StatType.RANGE, 1.0, 10.0);

        statService.reorderDefinitions(List.of(third.getId(), first.getId(), second.getId()), TEST_USER_ID);

        assertEquals(List.of(third.getId(), first.getId(), second.getId()),
                statService.getDefinitions(TEST_USER_ID).stream().map(StatDefinition::getId).toList());
        assertEquals(0, definitionRepository.findById(third.getId()).orElseThrow().getDisplayOrder());
        assertEquals(1, definitionRepository.findById(first.getId()).orElseThrow().getDisplayOrder());
        assertEquals(2, definitionRepository.findById(second.getId()).orElseThrow().getDisplayOrder());
    }

    StatDefinition createStatDefinition(StatType statType, Double minValue, Double maxValue) {
        return statService.createDefinition("name", "description",
                statType, minValue, maxValue, TEST_USER_ID);
    }

    private StatDefinition createNamedStatDefinition(String name, StatType type) {
        return createNamedStatDefinition(name, type, null, null);
    }

    private StatDefinition createNamedStatDefinition(String name, StatType type,
                                                     Double minValue, Double maxValue) {
        return statService.createDefinition(name, "description", type, minValue, maxValue, TEST_USER_ID);
    }
}
