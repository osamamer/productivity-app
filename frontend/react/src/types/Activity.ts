export type ActivityColor = 'violet' | 'blue' | 'teal' | 'green' | 'amber' | 'orange' | 'rose' | 'slate';

/** A kind of time the user plans for. A calendar event with an activity is a "chunk". */
export interface Activity {
    id: string;
    name: string;
    color: ActivityColor;
    displayOrder: number;
}

export interface ActivityInput {
    name?: string;
    color?: ActivityColor;
    displayOrder?: number;
}
