package org.osama.note;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest
@ActiveProfiles("test")
@Import(NoteCategoryService.class)
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {
                DependencyInjectionTestExecutionListener.class,
                TransactionalTestExecutionListener.class
        },
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class NoteCategoryServiceTest {
    private static final String USER_ID = "category-user";
    private static final String OTHER_USER_ID = "other-category-user";

    @Autowired
    private NoteCategoryService categoryService;

    @Autowired
    private NoteCategoryRepository categoryRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EntityManager entityManager;

    private User user;

    @BeforeEach
    void setUp() {
        user = saveUser(USER_ID, "categories@example.com", "category-user");
        saveUser(OTHER_USER_ID, "other-categories@example.com", "other-category-user");
    }

    @Test
    void createCategoryNormalizesNameAndColor() {
        NoteCategoryResponse response = categoryService.createCategory(
                new NoteCategoryRequest("  Deep   Work  ", "#8b7cf6"),
                USER_ID
        );

        NoteCategory savedCategory = categoryRepository.findById(response.id()).orElseThrow();
        assertEquals("Deep Work", response.name());
        assertEquals("#8B7CF6", response.color());
        assertEquals("deep work", savedCategory.getNormalizedName());
        assertEquals(USER_ID, savedCategory.getUser().getId());
    }

    @Test
    void duplicateNamesAreRejectedPerUserIgnoringCaseAndWhitespace() {
        categoryService.createCategory(new NoteCategoryRequest("Deep Work", "#8B7CF6"), USER_ID);

        assertThrows(IllegalArgumentException.class, () -> categoryService.createCategory(
                new NoteCategoryRequest(" deep   work ", "#2BAE9B"),
                USER_ID
        ));

        categoryService.createCategory(
                new NoteCategoryRequest("deep work", "#2BAE9B"),
                OTHER_USER_ID
        );
    }

    @Test
    void categoryInputMustHaveAValidNameColorAndUser() {
        assertThrows(IllegalArgumentException.class, () -> categoryService.createCategory(
                new NoteCategoryRequest("   ", "#8B7CF6"),
                USER_ID
        ));
        assertThrows(IllegalArgumentException.class, () -> categoryService.createCategory(
                new NoteCategoryRequest("x".repeat(81), "#8B7CF6"),
                USER_ID
        ));
        assertThrows(IllegalArgumentException.class, () -> categoryService.createCategory(
                new NoteCategoryRequest("Invalid color", "violet"),
                USER_ID
        ));
        assertThrows(IllegalArgumentException.class, () -> categoryService.createCategory(
                new NoteCategoryRequest("Missing user", "#8B7CF6"),
                "missing-user"
        ));
    }

    @Test
    void updateCategorySupportsPartialChangesAndEnforcesValidation() {
        NoteCategoryResponse created = categoryService.createCategory(
                new NoteCategoryRequest("Ideas", "#E5A83B"),
                USER_ID
        );

        NoteCategoryResponse updated = categoryService.updateCategory(
                created.id(),
                new NoteCategoryRequest(null, "#abcdef"),
                USER_ID
        );

        assertEquals("Ideas", updated.name());
        assertEquals("#ABCDEF", updated.color());
        assertThrows(IllegalArgumentException.class, () -> categoryService.updateCategory(
                created.id(),
                new NoteCategoryRequest("Ideas", "purple"),
                USER_ID
        ));
    }

    @Test
    void updateCannotRenameCategoryToAnotherExistingName() {
        categoryService.createCategory(new NoteCategoryRequest("Ideas", "#E5A83B"), USER_ID);
        NoteCategoryResponse work = categoryService.createCategory(
                new NoteCategoryRequest("Work", "#2BAE9B"),
                USER_ID
        );

        assertThrows(IllegalArgumentException.class, () -> categoryService.updateCategory(
                work.id(),
                new NoteCategoryRequest(" ideas ", null),
                USER_ID
        ));
    }

    @Test
    void anotherUserCannotUpdateOrDeleteCategory() {
        NoteCategoryResponse created = categoryService.createCategory(
                new NoteCategoryRequest("Private", "#E56B6F"),
                USER_ID
        );

        assertThrows(ResourceNotFoundException.class, () -> categoryService.updateCategory(
                created.id(),
                new NoteCategoryRequest("Stolen", null),
                OTHER_USER_ID
        ));
        assertThrows(ResourceNotFoundException.class, () -> categoryService.deleteCategory(
                created.id(),
                OTHER_USER_ID
        ));
    }

    @Test
    void deletingCategoryMovesItsNotesToUncategorized() {
        NoteCategoryResponse created = categoryService.createCategory(
                new NoteCategoryRequest("Temporary", "#4D91E3"),
                USER_ID
        );
        NoteCategory category = categoryRepository.findById(created.id()).orElseThrow();
        Note note = noteRepository.saveAndFlush(Note.builder()
                .id("categorized-note")
                .user(user)
                .title("Keep me")
                .content("")
                .category(category)
                .pinned(false)
                .build());

        categoryService.deleteCategory(created.id(), USER_ID);
        entityManager.flush();
        entityManager.clear();

        assertFalse(categoryRepository.existsById(created.id()));
        assertNull(noteRepository.findById(note.getId()).orElseThrow().getCategory());
    }

    private User saveUser(String id, String email, String username) {
        return userRepository.save(User.builder()
                .id(id)
                .email(email)
                .firstName("Category")
                .lastName("Tester")
                .username(username)
                .active(true)
                .build());
    }
}
