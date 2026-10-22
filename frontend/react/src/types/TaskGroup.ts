export interface TaskGroup {
    groupId: string;
    name: string;
    taskIds: string[];
    displayOrder: number;
    linkedToMentalThread?: boolean;
    isStatGroup?: boolean;
}
