package org.osama.note;

import java.time.LocalDateTime;

public record NoteCategoryResponse(
        String id,
        String name,
        String color,
        LocalDateTime createdAt
) {
    public static NoteCategoryResponse from(NoteCategory category) {
        return new NoteCategoryResponse(
                category.getId(),
                category.getName(),
                category.getColor(),
                category.getCreatedAt()
        );
    }
}
