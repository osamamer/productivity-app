export type ProjectColor = 'blue' | 'violet' | 'teal' | 'amber' | 'rose';
export type ProjectIcon = 'folder' | 'rocket' | 'lightbulb' | 'book' | 'home' | 'leaf';

export interface Project {
    projectId: string;
    name: string;
    description: string | null;
    color: ProjectColor;
    icon: ProjectIcon;
    creationDateTime: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
}

export interface ProjectInput {
    name: string;
    description: string | null;
    color: ProjectColor;
    icon: ProjectIcon;
}
