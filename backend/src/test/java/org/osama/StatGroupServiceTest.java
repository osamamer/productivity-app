package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatGroupResponse;
import org.osama.stat.StatGroupService;
import org.osama.stat.StatService;
import org.osama.stat.StatType;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class StatGroupServiceTest {
    private static final String TEST_USER_ID = "stat-group-test-user";
    private static final String OTHER_USER_ID = "stat-group-other-user";

    @Autowired private StatGroupService statGroupService;
    @Autowired private StatService statService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(user(TEST_USER_ID, "stat-groups@test.com", "statgroupuser"));
        userRepository.save(user(OTHER_USER_ID, "other-stat-groups@test.com", "otherstatgroupuser"));
    }

    @Test
    void groupsPersistMixedStatTypesAndMembership() {
        StatDefinition booleanStat = createStat("Meditated", StatType.BOOLEAN);
        StatDefinition numberStat = createStat("Sleep", StatType.NUMBER);
        StatDefinition rangeStat = statService.createDefinition(
                "Mood", null, StatType.RANGE, 1.0, 10.0, null, null, TEST_USER_ID);

        StatGroupResponse group = statGroupService.createGroup("Daily care", TEST_USER_ID);
        StatGroupResponse updated = statGroupService.replaceDefinitions(
                group.groupId(), List.of(booleanStat.getId(), numberStat.getId(), rangeStat.getId()), TEST_USER_ID);

        assertEquals(List.of(booleanStat.getId(), numberStat.getId(), rangeStat.getId()),
                updated.statDefinitionIds());
        assertEquals(updated, statGroupService.getGroups(TEST_USER_ID).get(0));
    }

    @Test
    void creatingAGroupWithSelectedDefinitionsPersistsMembership() {
        StatDefinition first = createStat("First", StatType.NUMBER);
        StatDefinition second = createStat("Second", StatType.BOOLEAN);

        StatGroupResponse group = statGroupService.createGroup(
                "Selected stats", List.of(first.getId(), second.getId()), TEST_USER_ID);

        assertEquals(List.of(first.getId(), second.getId()), group.statDefinitionIds());
    }

    @Test
    void reorderingGroupsPersistsTheSubmittedOrder() {
        StatGroupResponse first = statGroupService.createGroup("First", TEST_USER_ID);
        StatGroupResponse second = statGroupService.createGroup("Second", TEST_USER_ID);
        StatGroupResponse third = statGroupService.createGroup("Third", TEST_USER_ID);

        List<StatGroupResponse> reordered = statGroupService.reorderGroups(
                List.of(third.groupId(), first.groupId(), second.groupId()), TEST_USER_ID);

        assertEquals(List.of("Third", "First", "Second"),
                reordered.stream().map(StatGroupResponse::name).toList());
    }

    @Test
    void movingAStatDetachesItFromItsPreviousGroup() {
        StatDefinition first = createStat("First", StatType.NUMBER);
        StatDefinition second = createStat("Second", StatType.NUMBER);
        StatGroupResponse original = statGroupService.createGroup("Original", TEST_USER_ID);
        StatGroupResponse destination = statGroupService.createGroup("Destination", TEST_USER_ID);
        statGroupService.replaceDefinitions(original.groupId(), List.of(first.getId(), second.getId()), TEST_USER_ID);

        statGroupService.replaceDefinitions(destination.groupId(), List.of(second.getId()), TEST_USER_ID);

        List<StatGroupResponse> groups = statGroupService.getGroups(TEST_USER_ID);
        assertEquals(List.of(first.getId()), groups.get(0).statDefinitionIds());
        assertEquals(List.of(second.getId()), groups.get(1).statDefinitionIds());
    }

    @Test
    void groupingAnotherUsersStatIsRejected() {
        StatDefinition otherUsersStat = statService.createDefinition(
                "Other stat", null, StatType.NUMBER, null, null, null, null, OTHER_USER_ID);
        StatGroupResponse group = statGroupService.createGroup("Private", TEST_USER_ID);

        assertThrows(IllegalArgumentException.class, () -> statGroupService.replaceDefinitions(
                group.groupId(), List.of(otherUsersStat.getId()), TEST_USER_ID));
    }

    @Test
    void deletingAGroupLeavesItsStatsIntact() {
        StatDefinition stat = createStat("Keep me", StatType.NUMBER);
        StatGroupResponse group = statGroupService.createGroup("Temporary", TEST_USER_ID);
        statGroupService.replaceDefinitions(group.groupId(), List.of(stat.getId()), TEST_USER_ID);

        statGroupService.deleteGroup(group.groupId(), TEST_USER_ID);

        assertFalse(statGroupService.getGroups(TEST_USER_ID).stream()
                .anyMatch(candidate -> candidate.statDefinitionIds().contains(stat.getId())));
        assertEquals("Keep me", statService.getDefinitions(TEST_USER_ID).stream()
                .filter(candidate -> candidate.getId().equals(stat.getId()))
                .findFirst()
                .orElseThrow()
                .getName());
    }

    @Test
    void deletingAGroupedStatRemovesOnlyItsMembership() {
        StatDefinition stat = createStat("Remove me", StatType.NUMBER);
        StatGroupResponse group = statGroupService.createGroup("Temporary", TEST_USER_ID);
        statGroupService.replaceDefinitions(group.groupId(), List.of(stat.getId()), TEST_USER_ID);

        statService.deleteDefinition(stat.getId(), TEST_USER_ID);

        assertEquals(List.of(), statGroupService.getGroups(TEST_USER_ID).get(0).statDefinitionIds());
        assertFalse(statService.getDefinitions(TEST_USER_ID).stream()
                .anyMatch(candidate -> candidate.getId().equals(stat.getId())));
    }

    private StatDefinition createStat(String name, StatType type) {
        return statService.createDefinition(name, null, type, null, null, null, null, TEST_USER_ID);
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Stat")
                .lastName("Group")
                .username(username)
                .active(true)
                .build();
    }
}
