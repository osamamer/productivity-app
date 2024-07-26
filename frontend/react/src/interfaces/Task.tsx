export interface Task   {
    taskId: number;
    name: string;
    description: string;
    completed: boolean;
    creationDateTime: string;
    creationDate: string;
    scheduledPerformDateTime: string;
    completionDateTime: string;
    parentId: string;
    tag: string;
    importance: number;
}