export type InvalidatedResource = 'tasks' | 'stats' | 'projects';
export type ResourceInvalidationOrigin = 'task' | 'stat';

type ResourceInvalidationListener = (origin?: ResourceInvalidationOrigin) => void;

const listeners: Record<InvalidatedResource, Set<ResourceInvalidationListener>> = {
    tasks: new Set(),
    stats: new Set(),
    projects: new Set(),
};

export function subscribeToResourceInvalidation(
    resource: InvalidatedResource,
    listener: ResourceInvalidationListener,
): () => void {
    listeners[resource].add(listener);
    return () => listeners[resource].delete(listener);
}

export function invalidateResource(resource: InvalidatedResource, origin?: ResourceInvalidationOrigin): void {
    listeners[resource].forEach(listener => listener(origin));
}
