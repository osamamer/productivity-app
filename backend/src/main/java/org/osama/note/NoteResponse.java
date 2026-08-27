package org.osama.note;

import java.time.LocalDateTime;

public record NoteResponse(
        String id,
        String title,
        String content,
        String categoryId,
        boolean pinned,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static NoteResponse from(Note note) {
        String categoryId = note.getCategory() == null ? null : note.getCategory().getId();
        return new NoteResponse(
                note.getId(),
                note.getTitle(),
                note.getContent(),
                categoryId,
                note.isPinned(),
                note.getCreatedAt(),
                note.getUpdatedAt()
        );
    }
}
