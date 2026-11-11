import type { StatDefinition } from '../../types/Stats';

export function includeDirectStatChildren(
    selectedDefinitionIds: string[],
    definitions: StatDefinition[],
): string[] {
    const selectedIds = new Set(selectedDefinitionIds);
    definitions.forEach(definition => {
        if (definition.parentDefinitionId && selectedIds.has(definition.parentDefinitionId)) {
            selectedIds.add(definition.id);
        }
    });
    return Array.from(selectedIds);
}

export function groupStatDefinitions(definitions: StatDefinition[]): Array<{
    definition: StatDefinition;
    subDefinitions: StatDefinition[];
}> {
    const definitionsById = new Map(definitions.map(definition => [definition.id, definition]));
    const childrenByParentId = new Map<string, StatDefinition[]>();

    definitions.forEach(definition => {
        const parentId = definition.parentDefinitionId;
        if (!parentId || !definitionsById.has(parentId)) return;
        const children = childrenByParentId.get(parentId) ?? [];
        children.push(definition);
        childrenByParentId.set(parentId, children);
    });

    return definitions
        .filter(definition => !definition.parentDefinitionId || !definitionsById.has(definition.parentDefinitionId))
        .map(definition => ({
            definition,
            subDefinitions: childrenByParentId.get(definition.id) ?? [],
        }));
}

export function topLevelStatDefinitions(definitions: StatDefinition[]): StatDefinition[] {
    return groupStatDefinitions(definitions).map(group => group.definition);
}
