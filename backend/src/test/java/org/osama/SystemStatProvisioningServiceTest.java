package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatService;
import org.osama.stat.StatMorality;
import org.osama.stat.StatType;
import org.osama.stat.SystemStatCatalog;
import org.osama.stat.SystemStatProvisioningService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.osama.user.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class SystemStatProvisioningServiceTest {

    private static final String TEST_USER_ID = "system-stat-test-user";

    @Autowired private SystemStatProvisioningService provisioningService;
    @Autowired private StatDefinitionRepository definitionRepository;
    @Autowired private StatService statService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserService userService;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(TEST_USER_ID)
                .email("system-stats@test.com")
                .firstName("System")
                .lastName("Stats")
                .username("systemstats")
                .active(true)
                .build();
        userRepository.save(user);
    }

    @Test
    void provisioningCreatesEveryCatalogDefinitionExactlyOnce() {
        provisioningService.createMissingSystemStatsFor(user);
        provisioningService.createMissingSystemStatsFor(user);

        List<StatDefinition> definitions = definitionRepository.findAllByUserId(TEST_USER_ID);
        Set<String> systemKeys = definitions.stream()
                .map(StatDefinition::getSystemKey)
                .collect(Collectors.toSet());

        assertEquals(SystemStatCatalog.SYSTEM_STATS.size(), definitions.size());
        assertEquals(Set.of(
                SystemStatCatalog.MEDITATED_SYSTEM_KEY,
                SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY,
                SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY,
                SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY,
                SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY
        ), systemKeys);
        assertEquals(StatType.BOOLEAN, definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.MEDITATED_SYSTEM_KEY)
                .orElseThrow()
                .getType());
        assertEquals(StatType.NUMBER, definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY)
                .orElseThrow()
                .getType());
        StatDefinition sleep = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();
        assertEquals(StatType.DURATION, sleep.getType());
        assertEquals(StatMorality.GOOD, sleep.getMorality());
        assertEquals(8 * 60.0, sleep.getGoodThreshold());
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();
        assertEquals(StatType.TIME, sleepTime.getType());
        assertEquals(StatMorality.GOOD, sleepTime.getMorality());
        assertEquals(240.0, sleepTime.getGoodThreshold());
        StatDefinition wakeUpTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                .orElseThrow();
        assertEquals(StatType.TIME, wakeUpTime.getType());
        assertEquals(StatMorality.GOOD, wakeUpTime.getMorality());
        assertEquals(630.0, wakeUpTime.getGoodThreshold());
    }

    @Test
    void provisioningAdoptsAUserDefinitionWhoseNameMatchesABuiltInStat() {
        StatDefinition existing = statService.createDefinition(
                "sLeEp", "custom", StatType.NUMBER, null, null, TEST_USER_ID);

        provisioningService.createMissingSystemStatsFor(user);

        StatDefinition adopted = definitionRepository.findById(existing.getId()).orElseThrow();
        assertEquals(SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY, adopted.getSystemKey());
        assertEquals("Sleep", adopted.getName());
        assertEquals(StatType.DURATION, adopted.getType());
        assertEquals(StatMorality.GOOD, adopted.getMorality());
        assertEquals(8 * 60.0, adopted.getGoodThreshold());
        assertEquals(SystemStatCatalog.SYSTEM_STATS.size(),
                definitionRepository.findAllByUserId(TEST_USER_ID).size());
    }

    @Test
    void systemDefinitionsCannotBeDeleted() {
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition systemDefinition = definitionRepository.findAllByUserId(TEST_USER_ID).get(0);

        assertThrows(IllegalArgumentException.class,
                () -> statService.deleteDefinition(systemDefinition.getId(), TEST_USER_ID));
        assertTrue(definitionRepository.existsById(systemDefinition.getId()));
    }

    @Test
    void usersCanCustomizeSleepAndWakeUpTimeJudgement() {
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleepTime = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                .orElseThrow();

        StatDefinition updated = statService.updateDefinition(
                sleepTime.getId(), sleepTime.getName(), sleepTime.getDescription(),
                StatMorality.GOOD, 150.0, TEST_USER_ID);

        assertEquals(150.0, updated.getGoodThreshold());
        provisioningService.createMissingSystemStatsFor(user);
        assertEquals(150.0, definitionRepository.findById(sleepTime.getId()).orElseThrow().getGoodThreshold());
    }

    @Test
    void usersCanCustomizeSleepDurationTarget() {
        provisioningService.createMissingSystemStatsFor(user);
        StatDefinition sleep = definitionRepository
                .findByUserIdAndSystemKey(TEST_USER_ID, SystemStatCatalog.SLEEP_HOURS_SYSTEM_KEY)
                .orElseThrow();

        StatDefinition updated = statService.updateDefinition(
                sleep.getId(), sleep.getName(), sleep.getDescription(),
                StatMorality.GOOD, 9 * 60.0, TEST_USER_ID);

        assertEquals(9 * 60.0, updated.getGoodThreshold());
        provisioningService.createMissingSystemStatsFor(user);
        assertEquals(9 * 60.0, definitionRepository.findById(sleep.getId()).orElseThrow().getGoodThreshold());
    }

    @Test
    void userDefinitionNamesAreUniqueIgnoringCase() {
        statService.createDefinition("Energy", null, StatType.NUMBER, null, null, TEST_USER_ID);

        assertThrows(IllegalArgumentException.class,
                () -> statService.createDefinition(
                        "energy", null, StatType.NUMBER, null, null, TEST_USER_ID));
    }

    @Test
    void creatingAUserAutomaticallyProvisionsSystemStats() {
        User createdUser = userService.createUser(
                "new-system-stats@test.com", "New", "User", "newsystemstats", "keycloak-system-stats");

        assertEquals(SystemStatCatalog.SYSTEM_STATS.size(),
                definitionRepository.findAllByUserId(createdUser.getId()).size());
    }
}
