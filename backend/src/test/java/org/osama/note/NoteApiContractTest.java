package org.osama.note;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NoteApiContractTest {

    @Test
    void patchRequestDistinguishesMissingCategoryFromExplicitUncategorized() {
        UpdateNoteRequest request = new UpdateNoteRequest();

        assertFalse(request.isCategoryIdPresent());

        request.setCategoryId(null);

        assertTrue(request.isCategoryIdPresent());
        assertNull(request.getCategoryId());
    }

    @Test
    void noteResponseContainsOnlyTheFrontendContract() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 8, 26, 10, 0);
        LocalDateTime updatedAt = createdAt.plusHours(1);
        NoteCategory category = new NoteCategory();
        category.setId("category-1");
        Note note = new Note();
        note.setId("note-1");
        note.setTitle("Architecture notes");
        note.setContent("<p>Keep the boundary small.</p>");
        note.setCategory(category);
        note.setPinned(true);
        note.setCreatedAt(createdAt);
        note.setUpdatedAt(updatedAt);

        NoteResponse response = NoteResponse.from(note);

        assertEquals("note-1", response.id());
        assertEquals("Architecture notes", response.title());
        assertEquals("<p>Keep the boundary small.</p>", response.content());
        assertEquals("category-1", response.categoryId());
        assertTrue(response.pinned());
        assertEquals(createdAt, response.createdAt());
        assertEquals(updatedAt, response.updatedAt());
    }
}
