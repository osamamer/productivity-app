package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatService;
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

        assertEquals(SystemStatCatalog.MENTAL_STATE_STATS.size(), definitions.size());
        assertEquals(Set.of("stimulation", "hunger", "arousal", "valence"), systemKeys);
        assertTrue(definitions.stream().allMatch(definition -> definition.getType() == StatType.RANGE));
        assertTrue(definitions.stream().allMatch(definition -> definition.getMinValue() == 1.0));
        assertTrue(definitions.stream().allMatch(definition -> definition.getMaxValue() == 10.0));
    }

    @Test
    void provisioningAdoptsAUserDefinitionWhoseNameMatchesABuiltInStat() {
        StatDefinition existing = statService.createDefinition(
                "vAlEnCe", "custom", StatType.NUMBER, null, null, TEST_USER_ID);

        provisioningService.createMissingSystemStatsFor(user);

        StatDefinition adopted = definitionRepository.findById(existing.getId()).orElseThrow();
        assertEquals("valence", adopted.getSystemKey());
        assertEquals("Valence", adopted.getName());
        assertEquals(StatType.RANGE, adopted.getType());
        assertEquals(SystemStatCatalog.MENTAL_STATE_STATS.size(),
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

        assertEquals(SystemStatCatalog.MENTAL_STATE_STATS.size(),
                definitionRepository.findAllByUserId(createdUser.getId()).size());
    }
}
