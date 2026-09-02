package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class StatGroupService {
    private final StatGroupRepository groupRepository;
    private final StatDefinitionRepository definitionRepository;
    private final UserRepository userRepository;

    public StatGroupService(StatGroupRepository groupRepository,
                            StatDefinitionRepository definitionRepository,
                            UserRepository userRepository) {
        this.groupRepository = groupRepository;
        this.definitionRepository = definitionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<StatGroupResponse> getGroups(String userId) {
        return groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .map(StatGroupResponse::from)
                .toList();
    }

    @Transactional
    public StatGroupResponse createGroup(String name, String userId) {
        return createGroup(name, List.of(), userId);
    }

    @Transactional
    public StatGroupResponse createGroup(String name, List<String> definitionIds, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        List<String> requestedIds = definitionIds == null ? List.of() : definitionIds;
        List<StatDefinition> definitions = findOwnedDailyDefinitions(requestedIds, userId);
        detachDefinitionsFromOtherGroups(requestedIds, userId, null);

        StatGroup group = new StatGroup();
        group.setGroupId(UUID.randomUUID().toString());
        group.setUser(user);
        group.setName(validateName(name));
        group.setDisplayOrder(nextDisplayOrder(userId));
        group.setDefinitions(new LinkedHashSet<>(definitions));

        StatGroup savedGroup = groupRepository.save(group);
        log.info("Stat group created: userId={} groupId={} statCount={}",
                userId, savedGroup.getGroupId(), savedGroup.getDefinitions().size());
        return StatGroupResponse.from(savedGroup);
    }

    @Transactional
    public List<StatGroupResponse> reorderGroups(List<String> groupIds, String userId) {
        List<StatGroup> groups = groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId);
        Set<String> existingIds = groups.stream()
                .map(StatGroup::getGroupId)
                .collect(Collectors.toSet());

        if (groupIds == null || groupIds.size() != groups.size()
                || groupIds.stream().anyMatch(Objects::isNull)
                || groupIds.stream().distinct().count() != groupIds.size()
                || !existingIds.equals(Set.copyOf(groupIds))) {
            throw new IllegalArgumentException("The reorder list must contain every stat group exactly once.");
        }

        Map<String, StatGroup> groupsById = groups.stream()
                .collect(Collectors.toMap(StatGroup::getGroupId, group -> group));
        for (int index = 0; index < groupIds.size(); index++) {
            groupsById.get(groupIds.get(index)).setDisplayOrder(index);
        }
        groupRepository.saveAll(groups);
        log.info("Stat groups reordered: userId={} count={} orderedGroupIds={}",
                userId, groups.size(), groupIds);
        return getGroups(userId);
    }

    @Transactional
    public StatGroupResponse renameGroup(String groupId, String name, String userId) {
        StatGroup group = getGroupOrThrow(groupId, userId);
        group.setName(validateName(name));
        StatGroup savedGroup = groupRepository.save(group);
        log.info("Stat group renamed: userId={} groupId={}", userId, groupId);
        return StatGroupResponse.from(savedGroup);
    }

    @Transactional
    public StatGroupResponse replaceDefinitions(String groupId, List<String> definitionIds, String userId) {
        StatGroup group = getGroupOrThrow(groupId, userId);
        List<String> requestedIds = definitionIds == null ? List.of() : definitionIds;
        List<StatDefinition> definitions = findOwnedDailyDefinitions(requestedIds, userId);
        detachDefinitionsFromOtherGroups(requestedIds, userId, groupId);

        group.getDefinitions().clear();
        group.getDefinitions().addAll(definitions);
        StatGroup savedGroup = groupRepository.save(group);
        log.info("Stat group membership replaced: userId={} groupId={} statCount={}",
                userId, groupId, definitions.size());
        return StatGroupResponse.from(savedGroup);
    }

    private void detachDefinitionsFromOtherGroups(List<String> definitionIds, String userId,
                                                  String destinationGroupId) {
        Set<String> idsToMove = new LinkedHashSet<>(definitionIds);
        boolean detachedFromAnotherGroup = false;
        for (StatGroup otherGroup : groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId)) {
            if (otherGroup.getGroupId().equals(destinationGroupId)) continue;

            boolean changed = otherGroup.getDefinitions()
                    .removeIf(definition -> idsToMove.contains(definition.getId()));
            if (changed) {
                groupRepository.save(otherGroup);
                detachedFromAnotherGroup = true;
            }
        }
        if (detachedFromAnotherGroup) groupRepository.flush();
    }

    @Transactional
    public void deleteGroup(String groupId, String userId) {
        StatGroup group = getGroupOrThrow(groupId, userId);
        group.getDefinitions().clear();
        groupRepository.delete(group);
        log.info("Stat group deleted: userId={} groupId={}", userId, groupId);
    }

    @Transactional
    public void removeDefinitionFromGroups(String definitionId, String userId) {
        groupRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(group -> group.getDefinitions()
                        .removeIf(definition -> definition.getId().equals(definitionId)))
                .forEach(groupRepository::save);
    }

    private StatGroup getGroupOrThrow(String groupId, String userId) {
        return groupRepository.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Stat group not found: " + groupId));
    }

    private List<StatDefinition> findOwnedDailyDefinitions(List<String> definitionIds, String userId) {
        if (definitionIds.stream().anyMatch(Objects::isNull)
                || definitionIds.size() != definitionIds.stream().distinct().count()) {
            throw new IllegalArgumentException("A stat group must contain unique definitions.");
        }
        if (definitionIds.isEmpty()) return List.of();

        Set<String> requestedIds = Set.copyOf(definitionIds);
        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId).stream()
                .filter(definition -> requestedIds.contains(definition.getId()))
                .filter(definition -> !SystemStatCatalog.isMentalStateSystemKey(definition.getSystemKey()))
                .toList();
        if (definitions.size() != definitionIds.size()) {
            throw new IllegalArgumentException("All grouped statistics must belong to the current user.");
        }

        Map<String, StatDefinition> definitionsById = definitions.stream()
                .collect(Collectors.toMap(StatDefinition::getId, Function.identity()));
        return definitionIds.stream().map(definitionsById::get).toList();
    }

    private String validateName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A stat group must have a name.");
        }
        if (name.trim().length() > 120) {
            throw new IllegalArgumentException("Stat group names must be 120 characters or fewer.");
        }
        return name.trim();
    }

    private int nextDisplayOrder(String userId) {
        return groupRepository.findTopByUserIdOrderByDisplayOrderDesc(userId)
                .map(group -> group.getDisplayOrder() + 1)
                .orElse(0);
    }
}
