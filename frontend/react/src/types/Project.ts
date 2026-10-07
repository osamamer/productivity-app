export interface Project {
    projectId: string;
    name: string;
    description: string | null;
    creationDateTime: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
}

export interface ProjectInput {
    name: string;
    description: string | null;
}
