export interface NoteCategory {
    id: string;
    name: string;
    color: string;
    createdAt: string;
}

export interface Note {
    id: string;
    title: string;
    content: string;
    categoryId: string | null;
    pinned: boolean;
    createdAt: string;
    updatedAt: string;
}

export type NoteSort = 'updated' | 'created' | 'title';
