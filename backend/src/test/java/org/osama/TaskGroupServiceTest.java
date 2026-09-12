package org.osama;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.taskgroup.TaskGroupResponse;
import org.osama.taskgroup.TaskGroupService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class TaskGroupServiceTest {
    private static final String TEST_USER_ID = "task-group-test-user";
    private static final String OTHER_USER_ID = "task-group-other-user";

    @Autowired private TaskGroupService taskGroupService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(user(TEST_USER_ID, "groups@test.com", "groupuser"));
        userRepository.save(user(OTHER_USER_ID, "other-groups@test.com", "othergroupuser"));
    }

    @Test
    void reorderMainTasks_persistsTheSubmittedRelativeOrder() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        Task third = createTask(TEST_USER_ID, "Third");

        taskService.reorderMainTasks(List.of(third.getTaskId(), first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        assertEquals(
                List.of(third.getTaskId(), first.getTaskId(), second.getTaskId()),
                taskService.getTodayTasks(TEST_USER_ID).stream().map(Task::getTaskId).toList()
        );
    }

    @Test
    void reorderMainTasks_doesNotReturnSkippedTasks() {
        Task visible = createTask(TEST_USER_ID, "Visible");
        Task skipped = createTask(TEST_USER_ID, "Skipped");
        skipped.setSkipped(true);
        taskRepository.save(skipped);

        List<Task> reordered = taskService.reorderMainTasks(List.of(visible.getTaskId()), TEST_USER_ID);
        UpdateTaskRequest update = new UpdateTaskRequest();
        update.setName("Should stay hidden");

        assertEquals(List.of(visible.getTaskId()), reordered.stream().map(Task::getTaskId).toList());
        assertTrue(taskService.getTaskForUser(skipped.getTaskId(), TEST_USER_ID).isEmpty());
        assertTrue(taskService.updateTask(skipped.getTaskId(), update, TEST_USER_ID).isEmpty());
        assertEquals("Skipped", taskRepository.findTaskByTaskId(skipped.getTaskId()).orElseThrow().getName());
        assertTrue(taskRepository.findTaskByTaskId(skipped.getTaskId()).orElseThrow().isSkipped());
    }

    @Test
    void createTask_prependsToThePersistedOrder() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");

        assertEquals(
                List.of(second.getTaskId(), first.getTaskId()),
                taskService.getTodayTasks(TEST_USER_ID).stream().map(Task::getTaskId).toList()
        );
    }

    @Test
    void createTask_withoutADateRemainsUndated() {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Capture without scheduling");

        Task created = taskService.createTask(request, TEST_USER_ID);

        assertNull(created.getScheduledPerformDateTime());
    }

    @Test
    void createGroup_roundTripsMembershipWithoutMakingTasksSubtasks() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");

        TaskGroupResponse created = taskGroupService.createGroup(
                "Morning routine", List.of(first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        assertEquals("Morning routine", created.name());
        assertEquals(List.of(second.getTaskId(), first.getTaskId()), created.taskIds());
        assertNull(first.getParentId());
        assertEquals(1, taskGroupService.getGroups(TEST_USER_ID).size());
    }

    @Test
    void createGroup_rejectsTasksOwnedByAnotherUser() {
        Task ownTask = createTask(TEST_USER_ID, "Own task");
        Task otherTask = createTask(OTHER_USER_ID, "Other task");

        assertThrows(IllegalArgumentException.class, () -> taskGroupService.createGroup(
                "Invalid group", List.of(ownTask.getTaskId(), otherTask.getTaskId()), TEST_USER_ID));
    }

    @Test
    void createGroup_movesTasksOutOfTheirPreviousGroup() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        Task third = createTask(TEST_USER_ID, "Third");
        Task fourth = createTask(TEST_USER_ID, "Fourth");
        taskGroupService.createGroup(
                "Original", List.of(first.getTaskId(), second.getTaskId(), third.getTaskId()), TEST_USER_ID);

        taskGroupService.createGroup(
                "Regrouped", List.of(second.getTaskId(), fourth.getTaskId()), TEST_USER_ID);

        List<TaskGroupResponse> groups = taskGroupService.getGroups(TEST_USER_ID);
        assertEquals(2, groups.size());
        assertEquals(List.of(third.getTaskId(), first.getTaskId()), groups.get(0).taskIds());
        assertEquals(List.of(fourth.getTaskId(), second.getTaskId()), groups.get(1).taskIds());
    }

    @Test
    void removeTask_updatesMembershipWithoutChangingTaskHierarchy() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        Task third = createTask(TEST_USER_ID, "Third");
        TaskGroupResponse group = taskGroupService.createGroup(
                "Morning routine", List.of(first.getTaskId(), second.getTaskId(), third.getTaskId()), TEST_USER_ID);

        taskGroupService.removeTask(group.groupId(), second.getTaskId(), TEST_USER_ID);

        assertEquals(List.of(third.getTaskId(), first.getTaskId()), taskGroupService.getGroups(TEST_USER_ID).get(0).taskIds());
        assertNull(second.getParentId());
    }

    @Test
    void removeTask_dissolvesAGroupThatWouldHaveOnlyOneTask() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        TaskGroupResponse group = taskGroupService.createGroup(
                "Morning routine", List.of(first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        taskGroupService.removeTask(group.groupId(), second.getTaskId(), TEST_USER_ID);

        assertEquals(0, taskGroupService.getGroups(TEST_USER_ID).size());
    }

    @Test
    void taskMutationsAreScopedToTheCurrentUser() {
        Task otherUserTask = createTask(OTHER_USER_ID, "Other user's task");
        UpdateTaskRequest request = new UpdateTaskRequest();
        request.setName("Should not change");

        assertTrue(taskService.updateTask(otherUserTask.getTaskId(), request, TEST_USER_ID).isEmpty());
        taskService.deleteTask(otherUserTask.getTaskId(), TEST_USER_ID);

        assertTrue(taskService.getTaskForUser(otherUserTask.getTaskId(), OTHER_USER_ID).isPresent());
        assertEquals("Other user's task", taskService.getTaskForUser(
                otherUserTask.getTaskId(), OTHER_USER_ID).orElseThrow().getName());
    }

    @Test
    void updateTask_allowsScheduledDateToBeCleared() {
        Task task = createTask(TEST_USER_ID, "Task with a date");
        UpdateTaskRequest request = new UpdateTaskRequest();
        request.setScheduledPerformDateTime("");

        Task updatedTask = taskService.updateTask(task.getTaskId(), request, TEST_USER_ID).orElseThrow();

        assertNull(updatedTask.getScheduledPerformDateTime());
    }

    @Test
    void moveGroupToToday_updatesEveryTaskInTheGroup() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        first.setScheduledPerformDateTime(LocalDate.now().minusDays(2).atTime(9, 15));
        second.setScheduledPerformDateTime(null);
        taskService.updateTask(first.getTaskId(), updateDate(first.getScheduledPerformDateTime()), TEST_USER_ID);
        taskService.updateTask(second.getTaskId(), updateDate(null), TEST_USER_ID);
        TaskGroupResponse group = taskGroupService.createGroup(
                "Older work", List.of(first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        List<Task> movedTasks = taskGroupService.moveGroupToToday(group.groupId(), TEST_USER_ID);

        assertEquals(2, movedTasks.size());
        assertEquals(LocalDate.now(), first.getScheduledPerformDateTime().toLocalDate());
        assertEquals(LocalDate.now(), second.getScheduledPerformDateTime().toLocalDate());
        assertEquals(9, first.getScheduledPerformDateTime().getHour());
        assertEquals(15, first.getScheduledPerformDateTime().getMinute());
    }

    @Test
    void deletingATaskAlsoRemovesItsSubtasks() {
        Task parent = createTask(TEST_USER_ID, "Parent");
        NewTaskRequest subtaskRequest = new NewTaskRequest();
        subtaskRequest.setName("Child");
        subtaskRequest.setParentId(parent.getTaskId());
        subtaskRequest.setScheduledPerformDateTime(LocalDate.now().atTime(10, 0).toString());
        Task child = taskService.createTask(subtaskRequest, TEST_USER_ID);

        taskService.deleteTask(parent.getTaskId(), TEST_USER_ID);

        assertFalse(taskService.getTaskForUser(parent.getTaskId(), TEST_USER_ID).isPresent());
        assertFalse(taskService.getTaskForUser(child.getTaskId(), TEST_USER_ID).isPresent());
    }

    @Test
    void subtasksAreReturnedAndPersistedOldestFirst() {
        Task parent = createTask(TEST_USER_ID, "Parent");
        Task oldest = createSubtask(parent, "Oldest");
        Task newest = createSubtask(parent, "Newest");

        assertEquals(List.of(oldest.getTaskId(), newest.getTaskId()),
                taskService.getSubtasks(parent.getTaskId(), TEST_USER_ID).stream()
                        .map(Task::getTaskId)
                        .toList());
        assertEquals(0, oldest.getDisplayOrder());
        assertEquals(1, newest.getDisplayOrder());
    }

    @Test
    void deletingATaskAlsoRemovesItFromItsTaskGroup() {
        Task first = createTask(TEST_USER_ID, "First");
        Task second = createTask(TEST_USER_ID, "Second");
        taskGroupService.createGroup("Together", List.of(first.getTaskId(), second.getTaskId()), TEST_USER_ID);

        taskService.deleteTask(first.getTaskId(), TEST_USER_ID);

        assertEquals(0, taskGroupService.getGroups(TEST_USER_ID).size());
    }

    @Test
    void deletingAllFutureTasksKeepsNonFutureTasksAndOtherUsersTasks() {
        LocalDateTime futureDate = LocalDate.now().plusDays(2).atTime(9, 0);
        Task futureTask = createTask(TEST_USER_ID, "Future task", futureDate);
        NewTaskRequest subtaskRequest = new NewTaskRequest();
        subtaskRequest.setName("Future child");
        subtaskRequest.setParentId(futureTask.getTaskId());
        subtaskRequest.setScheduledPerformDateTime(futureDate.toString());
        Task futureSubtask = taskService.createTask(subtaskRequest, TEST_USER_ID);

        UpdateTaskRequest completeFutureTask = new UpdateTaskRequest();
        completeFutureTask.setCompleted(true);
        taskService.updateTask(futureTask.getTaskId(), completeFutureTask, TEST_USER_ID);

        Task todayTask = createTask(TEST_USER_ID, "Today task", LocalDate.now().atTime(9, 0));
        Task pastTask = createTask(TEST_USER_ID, "Past task", LocalDate.now().minusDays(1).atTime(9, 0));
        Task undatedTask = createTask(TEST_USER_ID, "Undated task", null);
        Task otherUserFutureTask = createTask(OTHER_USER_ID, "Other user's future task", futureDate);

        int deletedTaskCount = taskService.deleteAllFutureTasks(TEST_USER_ID);

        assertEquals(2, deletedTaskCount);
        assertFalse(taskService.getTaskForUser(futureTask.getTaskId(), TEST_USER_ID).isPresent());
        assertFalse(taskService.getTaskForUser(futureSubtask.getTaskId(), TEST_USER_ID).isPresent());
        assertTrue(taskService.getTaskForUser(todayTask.getTaskId(), TEST_USER_ID).isPresent());
        assertTrue(taskService.getTaskForUser(pastTask.getTaskId(), TEST_USER_ID).isPresent());
        assertTrue(taskService.getTaskForUser(undatedTask.getTaskId(), TEST_USER_ID).isPresent());
        assertTrue(taskService.getTaskForUser(otherUserFutureTask.getTaskId(), OTHER_USER_ID).isPresent());
    }

    private Task createTask(String userId, String name) {
        return createTask(userId, name, LocalDate.now().atTime(9, 0));
    }

    private Task createTask(String userId, String name, LocalDateTime scheduledDateTime) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setScheduledPerformDateTime(scheduledDateTime == null ? null : scheduledDateTime.toString());
        return taskService.createTask(request, userId);
    }

    private Task createSubtask(Task parent, String name) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(name);
        request.setParentId(parent.getTaskId());
        return taskService.createTask(request, TEST_USER_ID);
    }

    private UpdateTaskRequest updateDate(java.time.LocalDateTime dateTime) {
        UpdateTaskRequest request = new UpdateTaskRequest();
        request.setScheduledPerformDateTime(dateTime == null ? "" : dateTime.toString());
        return request;
    }

    private User user(String id, String email, String username) {
        return User.builder()
                .id(id)
                .email(email)
                .firstName("Task")
                .lastName("Group")
                .username(username)
                .active(true)
                .build();
    }
}
