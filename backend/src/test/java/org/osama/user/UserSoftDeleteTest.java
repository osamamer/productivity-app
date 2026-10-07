package org.osama.user;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.note.Note;
import org.osama.note.NoteRepository;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.taskgroup.TaskGroupResponse;
import org.osama.taskgroup.TaskGroupService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class UserSoftDeleteTest {
    private static final String USER_ID = "soft-delete-user";

    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskService taskService;
    @Autowired private TaskGroupService taskGroupService;
    @Autowired private NoteRepository noteRepository;
    @Autowired private EntityManager entityManager;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .email("soft-delete@example.com")
                .firstName("Soft")
                .lastName("Delete")
                .username("softdelete")
                .active(true)
                .build());
    }

    @Test
    void deletingAUserSoftDeletesOwnedRowsAndAssociationRows() {
        Task first = createTask("First");
        Task second = createTask("Second");
        TaskGroupResponse group = taskGroupService.createGroup(
                "Together", List.of(first.getTaskId(), second.getTaskId()), USER_ID);
        Note note = noteRepository.save(Note.builder()
                .id(UUID.randomUUID().toString())
                .user(userRepository.findById(USER_ID).orElseThrow())
                .title("Private note")
                .content("content")
                .build());

        userService.deleteUser(USER_ID);
        entityManager.flush();

        assertFalse(userRepository.findById(USER_ID).isPresent());
        assertFalse(taskRepository.findById(first.getTaskId()).isPresent());
        assertFalse(noteRepository.findById(note.getId()).isPresent());
        assertEquals(1, countRows("app_user", "id", USER_ID));
        assertEquals(2, countRows("task", "user_id", USER_ID));
        assertEquals(1, countRows("note", "id", note.getId()));
        assertEquals(2, countRows("task_group_task", "group_id", group.groupId()));
    }

    private Task createTask(String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        return taskService.createTask(request, USER_ID);
    }

    private long countRows(String table, String column, String value) {
        Object count = entityManager.createNativeQuery("select count(*) from " + table
                        + " where " + column + " = :value and soft_deleted = true")
                .setParameter("value", value)
                .getSingleResult();
        return ((Number) count).longValue();
    }
}
