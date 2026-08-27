package org.osama.note;

public record CreateNoteRequest(
        String title,
        String content,
        String categoryId,
        boolean pinned
) {
}
