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

    StatDefinition createStatDefinition(StatType statType, Double minValue, Double maxValue) {
        return statService.createDefinition("name", "description",
                statType, minValue, maxValue, TEST_USER_ID);
    }
}
