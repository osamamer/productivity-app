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
