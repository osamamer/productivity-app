package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.*;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskSkipReason;
import org.osama.task.TaskService;
import org.osama.task.recurrence.TaskSeriesRepository;
import org.osama.session.task.TaskSession;
import org.osama.session.task.TaskSessionRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskSessionRepository taskSessionRepository;
    @Autowired private TaskService taskService;
    @Autowired private TaskSeriesRepository taskSeriesRepository;

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
    void booleanStat_canBeMarkedNotPlannedWithoutBecomingNo() {
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);
        LocalDate today = LocalDate.now();

        StatEntry entry = statService.recordEntry(
                statDefinition.getId(), today, null, StatEntryStatus.NOT_PLANNED, TEST_USER_ID);

        assertEquals(0.0, entry.getValue());
        assertEquals(StatEntryStatus.NOT_PLANNED, entry.getStatus());
        assertEquals(0, statService.getSummary(statDefinition.getId(), today, today, TEST_USER_ID)
                .periodYesCount());
    }

    @Test
    void nonBooleanStat_cannotBeMarkedNotPlanned() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);

        assertThrows(IllegalArgumentException.class, () -> statService.recordEntry(
                statDefinition.getId(), LocalDate.now(), null,
                StatEntryStatus.NOT_PLANNED, TEST_USER_ID));
    }

    @Test
    void booleanStat_rejectsNonBinaryValue() {
        // Create definition first, THEN assert throws on the entry call only
        StatDefinition statDefinition = createStatDefinition(StatType.BOOLEAN, null, null);

        // The exception here taints the transaction — wrap in assertThrows cleanly
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), 0.6, TEST_USER_ID));
    }

    @Test
    void nullValue_clearsExistingEntry() {
        StatDefinition statDefinition = createStatDefinition(StatType.NUMBER, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today, 42.0, TEST_USER_ID);

        assertNull(statService.recordEntry(statDefinition.getId(), today, null, TEST_USER_ID));
        assertTrue(entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                statDefinition.getId(), TEST_USER_ID, today).isEmpty());
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

    // --- TIME ---

    @Test
    void timeStat_storesMinutesSinceMidnight() {
        StatDefinition statDefinition = createStatDefinition(StatType.TIME, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 0.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), LocalDate.now().plusDays(1), 23 * 60 + 59, TEST_USER_ID);

        assertEquals(1439.0, entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(
                        statDefinition.getId(), TEST_USER_ID, LocalDate.now().plusDays(1))
                .orElseThrow()
                .getValue());
    }

    @Test
    void timeStat_rejectsValuesOutsideTheDay() {
        StatDefinition statDefinition = createStatDefinition(StatType.TIME, null, null);

        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), -1.0, TEST_USER_ID));
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), 1440.0, TEST_USER_ID));
    }

    @Test
    void timeStatSupportsAnEarlierIsBetterThreshold() {
        StatDefinition statDefinition = statService.createDefinition(
                "Bedtime", null, StatType.TIME, null, null,
                StatMorality.GOOD, 180.0, TEST_USER_ID);

        assertEquals(StatMorality.GOOD, statDefinition.getMorality());
        assertEquals(180.0, statDefinition.getGoodThreshold());
    }

    @Test
    void sleepTimeSummaryTreatsTenPmAsEarlierThanFourAm() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        LocalDate today = LocalDate.now();
        statService.recordEntry(sleepTime.getId(), today.minusDays(1), 22 * 60.0, TEST_USER_ID);
        statService.recordEntry(sleepTime.getId(), today, 4 * 60.0, TEST_USER_ID);

        StatSummaryResponse summary = statService.getSummary(
                sleepTime.getId(), today.minusDays(1), today, TEST_USER_ID);

        assertEquals(60.0, summary.periodAverage(), 0.0001);
        assertEquals(4 * 60.0, summary.periodHighest(), 0.0001);
        assertTrue(StatTimeScale.toLinearValue(sleepTime, 22 * 60.0)
                < StatTimeScale.toLinearValue(sleepTime, 4 * 60.0));
    }

    @Test
    void sleepDurationIsCalculatedOnWakeUpDateWhenBothTimesAreRecorded() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition sleepDuration = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate wakeUpDate = LocalDate.now();

        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 22 * 60.0, TEST_USER_ID);
        assertTrue(entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).isEmpty());

        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 6 * 60.0, TEST_USER_ID);

        assertEquals(8 * 60.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).orElseThrow().getValue());
    }

    @Test
    void sleepDurationIsCalculatedWhenWakeUpTimeIsRecordedFirst() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition sleepDuration = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate wakeUpDate = LocalDate.now();

        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 7 * 60.0, TEST_USER_ID);
        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 23 * 60.0, TEST_USER_ID);

        assertEquals(8 * 60.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).orElseThrow().getValue());
    }

    @Test
    void sleepDurationIsRecalculatedWhenSleepTimeChanges() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition sleepDuration = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate wakeUpDate = LocalDate.now();

        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 22 * 60.0, TEST_USER_ID);
        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 6 * 60.0, TEST_USER_ID);
        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 21 * 60.0, TEST_USER_ID);

        assertEquals(9 * 60.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).orElseThrow().getValue());
    }

    @Test
    void sleepDurationIsRecalculatedWhenWakeUpTimeChanges() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition sleepDuration = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate wakeUpDate = LocalDate.now();

        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 22 * 60.0, TEST_USER_ID);
        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 6 * 60.0, TEST_USER_ID);
        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 7 * 60.0, TEST_USER_ID);

        assertEquals(9 * 60.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).orElseThrow().getValue());
    }

    @Test
    void manuallyRecordedSleepDurationIsRecalculatedWhenBoundaryChanges() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        StatDefinition sleepDuration = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate wakeUpDate = LocalDate.now();

        statService.recordEntry(sleepDuration.getId(), wakeUpDate, 7 * 60.0, TEST_USER_ID);
        statService.recordEntry(sleepTime.getId(), wakeUpDate.minusDays(1), 22 * 60.0, TEST_USER_ID);
        statService.recordEntry(wakeUpTime.getId(), wakeUpDate, 6 * 60.0, TEST_USER_ID);

        assertEquals(8 * 60.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                sleepDuration.getId(), TEST_USER_ID, wakeUpDate).orElseThrow().getValue());
    }

    // --- DURATION ---

    @Test
    void durationStat_acceptsWholeMinutesBeyondOneDay() {
        StatDefinition statDefinition = createStatDefinition(StatType.DURATION, null, null);
        statService.recordEntry(statDefinition.getId(), LocalDate.now(), 36 * 60 + 15, TEST_USER_ID);

        assertEquals(2175.0, entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(
                        statDefinition.getId(), TEST_USER_ID, LocalDate.now())
                .orElseThrow()
                .getValue());
    }

    @Test
    void durationStat_rejectsNegativeOrFractionalMinutes() {
        StatDefinition statDefinition = createStatDefinition(StatType.DURATION, null, null);

        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now(), -1.0, TEST_USER_ID));
        assertThrows(IllegalArgumentException.class, () ->
                statService.recordEntry(statDefinition.getId(), LocalDate.now().plusDays(1), 1.5, TEST_USER_ID));
    }

    @Test
    void durationSummaryUsesMinutesForAverageTotalAndHighest() {
        StatDefinition statDefinition = createStatDefinition(StatType.DURATION, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(statDefinition.getId(), today.minusDays(1), 60.0, TEST_USER_ID);
        statService.recordEntry(statDefinition.getId(), today, 90.0, TEST_USER_ID);

        StatSummaryResponse summary = statService.getSummary(
                statDefinition.getId(), today.minusDays(1), today, TEST_USER_ID);

        assertEquals(75.0, summary.periodAverage(), 0.0001);
        assertEquals(150.0, summary.periodTotal(), 0.0001);
        assertEquals(90.0, summary.periodHighest(), 0.0001);
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

    @Test
    void definitionCreationRejectsDuplicateStatNameIgnoringCaseAndWhitespace() {
        createNamedStatDefinition("Already used", StatType.BOOLEAN);

        assertThrows(IllegalArgumentException.class, () -> statService.createDefinition(
                "  ALREADY USED  ", null, StatType.BOOLEAN, null, null,
                StatMorality.NEUTRAL, null, TEST_USER_ID));
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
    void sleepDurationSummaryNeverCountsUnloggedDaysAsZero() {
        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleep = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        LocalDate today = LocalDate.now();
        statService.recordEntry(sleep.getId(), today.minusDays(2), 480.0, TEST_USER_ID);
        statService.recordEntry(sleep.getId(), today, 360.0, TEST_USER_ID);

        user.setIncludeUnloggedNumericDaysAsZero(true);
        userRepository.save(user);

        StatSummaryResponse summary = statService.getSummary(
                sleep.getId(), today.minusDays(2), today, TEST_USER_ID);

        assertEquals(420.0, summary.periodAverage(), 0.0001);
        assertEquals(840.0, summary.periodTotal(), 0.0001);
    }

    @Test
    void durationSummaryCanIncludeUnloggedDaysAsZeroWhenPreferenceIsEnabled() {
        StatDefinition duration = createStatDefinition(StatType.DURATION, null, null);
        LocalDate today = LocalDate.now();
        statService.recordEntry(duration.getId(), today.minusDays(2), 60.0, TEST_USER_ID);
        statService.recordEntry(duration.getId(), today, 90.0, TEST_USER_ID);

        User user = userRepository.findUserById(TEST_USER_ID).orElseThrow();
        user.setIncludeUnloggedNumericDaysAsZero(true);
        userRepository.save(user);

        StatSummaryResponse summary = statService.getSummary(
                duration.getId(), today.minusDays(2), today, TEST_USER_ID);

        assertEquals(50.0, summary.periodAverage(), 0.0001);
        assertEquals(150.0, summary.periodTotal(), 0.0001);
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
    void bootstrapLoadsAllDailyStatsEntriesAndSummariesInTheRequestedWindow() {
        StatDefinition number = createNamedStatDefinition("Steps", StatType.NUMBER);
        StatDefinition habit = createNamedStatDefinition("Read", StatType.BOOLEAN);
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(29);

        statService.recordEntry(number.getId(), today.minusDays(1), 8000.0, TEST_USER_ID);
        statService.recordEntry(habit.getId(), today, 1.0, TEST_USER_ID);
        statService.recordEntry(number.getId(), from.minusDays(1), 9999.0, TEST_USER_ID);

        StatBootstrapResponse bootstrap = statService.getBootstrap(from, today, TEST_USER_ID);

        assertEquals(List.of(number.getId(), habit.getId()),
                bootstrap.definitions().stream().map(StatDefinition::getId).toList());
        assertEquals(1, bootstrap.entries().get(number.getId()).size());
        assertEquals(1, bootstrap.entries().get(habit.getId()).size());
        assertEquals(8000.0, bootstrap.entries().get(number.getId()).get(0).getValue());
        assertEquals(8000.0, bootstrap.summaries().get(number.getId()).periodTotal(), 0.0001);
        assertEquals(1, bootstrap.summaries().get(habit.getId()).periodYesCount());
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

    @Test
    void booleanStatAndDailyTaskStaySynchronizedInBothDirections() {
        StatDefinition definition = createNamedStatDefinition("Drink water", StatType.BOOLEAN);
        StatDefinition linkedDefinition = statService.createRecurringTask(definition.getId(), TEST_USER_ID);
        Task todayTask = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                        linkedDefinition.getRecurringTaskSeriesId()).stream()
                .filter(task -> LocalDate.now().equals(task.getSeriesOccurrenceAt().toLocalDate()))
                .findFirst()
                .orElseThrow();

        statService.recordEntry(definition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        assertTrue(taskRepository.findTaskByTaskId(todayTask.getTaskId()).orElseThrow().isCompleted());

        statService.recordEntry(definition.getId(), LocalDate.now(), 0.0, TEST_USER_ID);
        assertFalse(taskRepository.findTaskByTaskId(todayTask.getTaskId()).orElseThrow().isCompleted());

        statService.recordEntry(definition.getId(), LocalDate.now(), null, TEST_USER_ID);
        assertFalse(taskRepository.findTaskByTaskId(todayTask.getTaskId()).orElseThrow().isCompleted());
        assertTrue(entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                definition.getId(), TEST_USER_ID, LocalDate.now()).isEmpty());

        statService.recordEntry(definition.getId(), LocalDate.now(), null,
                StatEntryStatus.NOT_PLANNED, TEST_USER_ID);
        Task notPlannedTask = taskRepository.findTaskByTaskId(todayTask.getTaskId()).orElseThrow();
        assertFalse(notPlannedTask.isCompleted());
        assertTrue(notPlannedTask.isSkipped());
        assertEquals(TaskSkipReason.USER, notPlannedTask.getSkipReason());

        UpdateTaskRequest completeTask = new UpdateTaskRequest();
        completeTask.setCompleted(true);
        taskService.updateTask(todayTask.getTaskId(), completeTask, TEST_USER_ID);
        assertEquals(1.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                definition.getId(), TEST_USER_ID, LocalDate.now()).orElseThrow().getValue());

        UpdateTaskRequest reopenTask = new UpdateTaskRequest();
        reopenTask.setCompleted(false);
        taskService.updateTask(todayTask.getTaskId(), reopenTask, TEST_USER_ID);
        assertEquals(0.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                definition.getId(), TEST_USER_ID, LocalDate.now()).orElseThrow().getValue());
    }

    @Test
    void booleanStatCanUseSelectedWeekdaysForItsRecurringTask() {
        StatDefinition definition = createNamedStatDefinition("Workout", StatType.BOOLEAN);

        StatDefinition linked = statService.createRecurringTask(
                definition.getId(), TEST_USER_ID, "UTC",
                org.osama.task.recurrence.TaskRecurrenceFrequency.CUSTOM,
                List.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), "08:30");

        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                linked.getRecurringTaskSeriesId());

        assertFalse(occurrences.isEmpty());
        assertEquals(LocalTime.of(8, 30), occurrences.get(0).getScheduledPerformDateTime().toLocalTime());
        assertTrue(occurrences.stream()
                .allMatch(task -> task.getSeriesOccurrenceAt().getDayOfWeek() == DayOfWeek.MONDAY
                        || task.getSeriesOccurrenceAt().getDayOfWeek() == DayOfWeek.WEDNESDAY));
    }

    @Test
    void booleanStatKeepsAnEligibleCurrentDayWhenTheSelectedTimeHasPassed() {
        ZoneId timeZone = ZoneId.of("UTC");
        LocalDate today = LocalDate.now(timeZone);
        LocalTime timeEarlierToday = LocalTime.now(timeZone).minusMinutes(2);
        String requestedTime = timeEarlierToday.format(DateTimeFormatter.ofPattern("HH:mm"));
        StatDefinition definition = createNamedStatDefinition("Read", StatType.BOOLEAN);

        StatDefinition linked = statService.createRecurringTask(
                definition.getId(), TEST_USER_ID, timeZone.getId(),
                org.osama.task.recurrence.TaskRecurrenceFrequency.CUSTOM,
                List.of(today.getDayOfWeek(), today.plusDays(1).getDayOfWeek()), requestedTime);

        Task firstOccurrence = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                        linked.getRecurringTaskSeriesId()).get(0);

        assertEquals(today, firstOccurrence.getSeriesOccurrenceAt().toLocalDate());
        assertEquals(today.atTime(timeEarlierToday.withSecond(0).withNano(0)),
                firstOccurrence.getScheduledPerformDateTime());
    }

    @Test
    void recurringTaskScheduleCanBeChangedAndItsSeriesCanBeDeleted() {
        StatDefinition definition = createNamedStatDefinition("Scheduled habit", StatType.BOOLEAN);
        StatDefinition linked = statService.createRecurringTask(definition.getId(), TEST_USER_ID);
        String seriesId = linked.getRecurringTaskSeriesId();

        statService.updateRecurringTask(
                definition.getId(), TEST_USER_ID, "UTC",
                org.osama.task.recurrence.TaskRecurrenceFrequency.CUSTOM,
                List.of(DayOfWeek.SUNDAY, DayOfWeek.THURSDAY), "07:15");

        assertEquals("SUNDAY,THURSDAY",
                taskSeriesRepository.findById(seriesId).orElseThrow().getRecurrenceDaysOfWeek());
        assertEquals(LocalTime.of(7, 15),
                taskSeriesRepository.findById(seriesId).orElseThrow().getStartDateTime().toLocalTime());

        StatDefinition deleted = statService.deleteRecurringTaskSeries(definition.getId(), TEST_USER_ID);

        assertNull(deleted.getRecurringTaskSeriesId());
        assertTrue(taskSeriesRepository.findById(seriesId).isEmpty());
        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId).isEmpty());
    }

    @Test
    void statRecurringTaskPriorityAppliesToAllOccurrences() {
        StatDefinition definition = createNamedStatDefinition("Priority habit", StatType.BOOLEAN);
        StatDefinition linked = statService.createRecurringTask(
                definition.getId(), TEST_USER_ID, "UTC",
                org.osama.task.recurrence.TaskRecurrenceFrequency.DAILY,
                null, "08:30", 9);
        String seriesId = linked.getRecurringTaskSeriesId();

        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId)
                .stream().allMatch(task -> task.getImportance() == 9));

        statService.updateRecurringTask(
                definition.getId(), TEST_USER_ID, "UTC",
                org.osama.task.recurrence.TaskRecurrenceFrequency.DAILY,
                null, "08:30", 6);

        assertEquals(6, taskSeriesRepository.findById(seriesId).orElseThrow().getImportance());
        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId)
                .stream().allMatch(task -> task.getImportance() == 6));
    }

    @Test
    void startingFocusCreatesScheduledLinkedTaskWithPriority() {
        StatDefinition definition = createNamedStatDefinition("Writing", StatType.BOOLEAN);

        Task task = statService.startFocusTask(definition.getId(), "Deep writing", 9, "UTC", TEST_USER_ID);

        assertEquals("Deep writing", task.getName());
        assertEquals(9, task.getImportance());
        assertNotNull(task.getScheduledPerformDateTime());
        assertEquals("Deep writing", definitionRepository.findById(definition.getId()).orElseThrow()
                .getFocusTaskName());
    }

    @Test
    void linkedBooleanStatExposesFocusTimeForItsRecurringOccurrences() {
        StatDefinition definition = statService.createDefinition(
                "Daily focus", null, StatType.BOOLEAN, null, null,
                StatMorality.NEUTRAL, null, true, TEST_USER_ID);
        LocalDate today = LocalDate.now();
        Task todayTask = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                        definition.getRecurringTaskSeriesId()).stream()
                .filter(task -> today.equals(task.getSeriesOccurrenceAt().toLocalDate()))
                .findFirst()
                .orElseThrow();

        TaskSession focusSession = new TaskSession();
        focusSession.setSessionId("daily-focus-session");
        focusSession.setAssociatedTaskId(todayTask.getTaskId());
        focusSession.setPomodoro(true);
        focusSession.setActive(false);
        focusSession.setRunning(false);
        focusSession.setTotalSessionTime(Duration.ofMinutes(25));
        focusSession.setStartTime(today.atTime(9, 0));
        focusSession.setEndTime(today.atTime(9, 25));
        taskSessionRepository.save(focusSession);

        Map<LocalDate, Long> focusByDate = statService.getFocusTime(
                        definition.getId(), today.minusDays(1), today, TEST_USER_ID).stream()
                .collect(java.util.stream.Collectors.toMap(StatFocusTimeEntryResponse::date,
                        StatFocusTimeEntryResponse::totalFocusSeconds));

        assertEquals(Map.of(today, Duration.ofMinutes(25).toSeconds()), focusByDate);
    }

    @Test
    void focusTaskLinkIncludesCompletedTasksByNameAndIgnoresNonPomodoroSessions() {
        StatDefinition definition = createNamedStatDefinition("Writing", StatType.BOOLEAN);
        LocalDate today = LocalDate.now();
        Task completedWrite = createTask("Write");
        Task currentWrite = createTask("write");
        Task unrelatedTask = createTask("Read");

        UpdateTaskRequest completeTask = new UpdateTaskRequest();
        completeTask.setCompleted(true);
        taskService.updateTask(completedWrite.getTaskId(), completeTask, TEST_USER_ID);

        taskSessionRepository.save(session("completed-write-session", completedWrite.getTaskId(),
                true, today.minusDays(1), 25));
        taskSessionRepository.save(session("current-write-session", currentWrite.getTaskId(),
                true, today, 15));
        taskSessionRepository.save(session("unrelated-session", unrelatedTask.getTaskId(),
                true, today, 40));
        taskSessionRepository.save(session("regular-write-session", currentWrite.getTaskId(),
                false, today, 90));

        StatDefinition linked = statService.linkFocusTask(definition.getId(), "  WRITE  ", TEST_USER_ID);

        Map<LocalDate, Long> focusByDate = statService.getFocusTime(
                        linked.getId(), today.minusDays(1), today, TEST_USER_ID).stream()
                .collect(java.util.stream.Collectors.toMap(StatFocusTimeEntryResponse::date,
                        StatFocusTimeEntryResponse::totalFocusSeconds));

        assertEquals("WRITE", linked.getFocusTaskName());
        assertEquals(Map.of(
                today.minusDays(1), Duration.ofMinutes(25).toSeconds(),
                today, Duration.ofMinutes(15).toSeconds()), focusByDate);

        StatDefinition unlinked = statService.unlinkFocusTask(linked.getId(), TEST_USER_ID);

        assertNull(unlinked.getFocusTaskName());
        assertTrue(statService.getFocusTime(unlinked.getId(), today.minusDays(1), today, TEST_USER_ID).isEmpty());
    }

    @Test
    void focusTaskLinkSupportsMultipleTaskNamesAndRemovingOne() {
        StatDefinition definition = createNamedStatDefinition("Deep work", StatType.BOOLEAN);
        LocalDate today = LocalDate.now();
        Task writingTask = createTask("Writing");
        Task planningTask = createTask("Planning");

        taskSessionRepository.save(session("writing-session", writingTask.getTaskId(), true, today, 25));
        taskSessionRepository.save(session("planning-session", planningTask.getTaskId(), true, today, 15));

        statService.linkFocusTask(definition.getId(), "writing", TEST_USER_ID);
        StatDefinition linkedBoth = statService.linkFocusTask(definition.getId(), "Planning", TEST_USER_ID);

        assertEquals(Set.of("Planning", "writing"), Set.copyOf(linkedBoth.getFocusTaskNames()));
        assertEquals(Duration.ofMinutes(40).toSeconds(), statService.getFocusTime(
                definition.getId(), today, today, TEST_USER_ID).getFirst().totalFocusSeconds());

        StatDefinition linkedPlanningOnly = statService.unlinkFocusTask(
                definition.getId(), "writing", TEST_USER_ID);

        assertEquals(List.of("Planning"), linkedPlanningOnly.getFocusTaskNames());
        assertEquals(Duration.ofMinutes(15).toSeconds(), statService.getFocusTime(
                definition.getId(), today, today, TEST_USER_ID).getFirst().totalFocusSeconds());
        assertEquals("Planning", linkedPlanningOnly.getFocusTaskName());
    }

    @Test
    void booleanStatCanCreateAndDisconnectRecurringTaskWithoutDeletingData() {
        StatDefinition definition = statService.createDefinition(
                "Daily reading", "description", StatType.BOOLEAN, null, null,
                StatMorality.NEUTRAL, null, true, TEST_USER_ID);
        String seriesId = definition.getRecurringTaskSeriesId();
        assertNotNull(seriesId);
        List<Task> tasksBeforeDisconnect = taskRepository
                .findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId);

        statService.recordEntry(definition.getId(), LocalDate.now(), 1.0, TEST_USER_ID);
        StatDefinition disconnected = statService.disconnectRecurringTask(definition.getId(), TEST_USER_ID);

        assertNull(disconnected.getRecurringTaskSeriesId());
        assertEquals(tasksBeforeDisconnect.size(),
                taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(seriesId).size());
        assertEquals(1.0, entryRepository.findByStatDefinitionIdAndUserIdAndDate(
                definition.getId(), TEST_USER_ID, LocalDate.now()).orElseThrow().getValue());
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

    private Task createTask(String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setDescription("");
        request.setScheduledPerformDateTime("");
        return taskService.createTask(request, TEST_USER_ID);
    }

    private TaskSession session(String sessionId, String taskId, boolean pomodoro,
                                LocalDate date, long minutes) {
        TaskSession session = new TaskSession();
        session.setSessionId(sessionId);
        session.setAssociatedTaskId(taskId);
        session.setPomodoro(pomodoro);
        session.setActive(false);
        session.setRunning(false);
        session.setTotalSessionTime(Duration.ofMinutes(minutes));
        LocalDateTime start = date.atTime(9, 0);
        session.setStartTime(start);
        session.setEndTime(start.plusMinutes(minutes));
        return session;
    }
}
