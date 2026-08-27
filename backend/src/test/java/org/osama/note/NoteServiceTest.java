package org.osama.note;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
@Import(NoteService.class)
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {
                DependencyInjectionTestExecutionListener.class,
                TransactionalTestExecutionListener.class
        },
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class NoteServiceTest {
    private static final String USER_ID = "note-service-user";

    @Autowired
    private NoteService noteService;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .id(USER_ID)
                .email("notes@example.com")
                .firstName("Note")
                .lastName("Tester")
                .username("note-tester")
                .active(true)
                .build());
    }

    @Test
    void createNoteUsesTheNextHighestUntitledSuffix() {
        saveNote("Untitled 2");
        saveNote("Untitled 9");
        saveNote("Untitled idea");

        NoteResponse response = noteService.createNote(
                new CreateNoteRequest("Untitled", "", null, false),
                USER_ID
        );

        assertEquals("Untitled 10", response.title());
    }

    @Test
    void createNoteHandlesMissingTextAndSanitizesQuillHtml() {
        NoteResponse emptyNote = noteService.createNote(
                new CreateNoteRequest(null, null, null, false),
                USER_ID
        );
        NoteResponse formattedNote = noteService.createNote(
                new CreateNoteRequest(
                        "Formatted",
                        "<h1>Heading</h1><script>alert('x')</script><s>old</s>",
                        null,
                        false
                ),
                USER_ID
        );

        assertEquals("Untitled 1", emptyNote.title());
        assertEquals("", emptyNote.content());
        assertTrue(formattedNote.content().contains("<h1>Heading</h1>"));
        assertTrue(formattedNote.content().contains("<s>old</s>"));
        assertFalse(formattedNote.content().contains("<script>"));
    }

    private void saveNote(String title) {
        noteRepository.save(Note.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .title(title)
                .content("")
                .pinned(false)
                .build());
    }
}
