import { Project, ProjectInput } from '../../types/Project';
import { Task } from '../../types/Task';
import { getAuthCacheScope, getAuthHeaders } from '../utils/authHeaders';
import { CachedResource } from '../cache/ttlCache';
import { subscribeToResourceInvalidation } from '../cache/resourceInvalidation';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const PROJECTS_URL = `${API_BASE_URL}/api/v1/projects`;
const TASKS_URL = `${API_BASE_URL}/api/v1/tasks`;
const PROJECTS_TTL_MS = 60 * 60 * 1000;
const PROJECT_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const projectsCache = new CachedResource<Project[]>({ ttlMs: PROJECTS_TTL_MS, maxEntries: 4 });

function projectsCacheKey(): string {
    return `${getAuthCacheScope()}:projects`;
}

function projectsStorageKey(): string {
    return `claritard:${projectsCacheKey()}`;
}

function compareProjectNames(first: Project, second: Project): number {
    return first.name.localeCompare(second.name, undefined, { sensitivity: 'base' });
}

function readPersistedProjects(): Project[] | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.sessionStorage.getItem(projectsStorageKey());
        if (!raw) return undefined;
        const snapshot = JSON.parse(raw) as { savedAt?: number; projects?: Project[] };
        if (!Array.isArray(snapshot.projects)
            || typeof snapshot.savedAt !== 'number'
            || Date.now() - snapshot.savedAt > PROJECT_SNAPSHOT_MAX_AGE_MS) {
            window.sessionStorage.removeItem(projectsStorageKey());
            return undefined;
        }
        return snapshot.projects;
    } catch (error) {
        console.warn('Could not read the cached projects:', error);
        return undefined;
    }
}

function persistProjects(projects: Project[]): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(projectsStorageKey(), JSON.stringify({ savedAt: Date.now(), projects }));
    } catch (error) {
        console.warn('Could not persist the cached projects:', error);
    }
}

// The persisted snapshot keeps seeded views flash-free while the in-memory
// entry is dropped so the next read reconciles with the server.
function setProjectsSnapshot(projects: Project[]): void {
    persistProjects(projects);
    projectsCache.invalidate(projectsCacheKey());
}

function updateProjectsSnapshot(update: (projects: Project[]) => Project[]): void {
    const projects = projectsCache.getStale(projectsCacheKey()) ?? readPersistedProjects();
    if (projects) setProjectsSnapshot(update(projects));
}

function markProjectsStale(): void {
    projectsCache.invalidate(projectsCacheKey());
}

subscribeToResourceInvalidation('tasks', markProjectsStale);
subscribeToResourceInvalidation('projects', markProjectsStale);

function jsonHeaders() {
    return {
        'Content-Type': 'application/json; charset=UTF-8',
        ...getAuthHeaders(),
    };
}

async function responseJson<T>(response: Response, errorMessage: string): Promise<T> {
    if (!response.ok) throw new Error(errorMessage);
    return response.json() as Promise<T>;
}

export const projectService = {
    getCachedProjects(): Project[] | undefined {
        return projectsCache.getStale(projectsCacheKey()) ?? readPersistedProjects();
    },

    async getProjects(): Promise<Project[]> {
        return projectsCache.get(projectsCacheKey(), async () => {
            const response = await fetch(PROJECTS_URL, { headers: getAuthHeaders() });
            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }
            const projects = await response.json() as Project[];
            persistProjects(projects);
            return projects;
        });
    },

    async createProject(input: ProjectInput): Promise<Project> {
        const response = await fetch(PROJECTS_URL, {
            method: 'POST',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        const createdProject = await responseJson<Project>(response, 'Failed to create project');
        const projects = projectsCache.getStale(projectsCacheKey()) ?? readPersistedProjects() ?? [];
        setProjectsSnapshot([...projects, createdProject].sort(compareProjectNames));
        return createdProject;
    },

    async updateProject(projectId: string, input: Partial<ProjectInput>): Promise<Project> {
        const response = await fetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'PATCH',
            headers: jsonHeaders(),
            body: JSON.stringify(input),
        });
        const updatedProject = await responseJson<Project>(response, 'Failed to update project');
        updateProjectsSnapshot(projects => projects.map(project => (
            project.projectId === updatedProject.projectId ? updatedProject : project
        )));
        return updatedProject;
    },

    async deleteProject(projectId: string): Promise<void> {
        const response = await fetch(`${PROJECTS_URL}/${projectId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to delete project');
        }
        updateProjectsSnapshot(projects => projects.filter(project => project.projectId !== projectId));
    },

    async getProjectTasks(projectId: string): Promise<Task[]> {
        const response = await fetch(`${TASKS_URL}?projectId=${encodeURIComponent(projectId)}`, {
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error('Failed to fetch project tasks');
        }
        const tasks = await response.json() as Task[];
        return tasks.filter(task => !task.skipped && !task.parentId);
    },

    clearCache(): void {
        projectsCache.clear();
        if (typeof window !== 'undefined') {
            try {
                window.sessionStorage.removeItem(projectsStorageKey());
            } catch (error) {
                console.warn('Could not clear the cached projects:', error);
            }
        }
    },
};
