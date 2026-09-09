export type InvalidatedResource = 'tasks' | 'stats';

type ResourceInvalidationListener = () => void;

const listeners: Record<InvalidatedResource, Set<ResourceInvalidationListener>> = {
  tasks: new Set(),
  stats: new Set(),
};

export function subscribeToResourceInvalidation(
  resource: InvalidatedResource,
  listener: ResourceInvalidationListener,
): () => void {
  listeners[resource].add(listener);
  return () => listeners[resource].delete(listener);
}

export function invalidateResource(resource: InvalidatedResource): void {
  listeners[resource].forEach(listener => listener());
}
