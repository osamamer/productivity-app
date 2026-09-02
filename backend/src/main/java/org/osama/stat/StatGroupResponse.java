package org.osama.stat;

import java.util.Comparator;
import java.util.List;

public record StatGroupResponse(String groupId, String name, List<String> statDefinitionIds,
                                int displayOrder) {
    static StatGroupResponse from(StatGroup group) {
        List<String> statDefinitionIds = group.getDefinitions().stream()
                .sorted(Comparator
                        .comparing(StatDefinition::getDisplayOrder,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(StatDefinition::getId))
                .map(StatDefinition::getId)
                .toList();
        return new StatGroupResponse(group.getGroupId(), group.getName(), statDefinitionIds,
                group.getDisplayOrder());
    }
}
