package org.osama.task.recurrence;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskSkipReason;
import org.osama.task.TaskService;
import org.osama.requests.UpdateTaskRequest;
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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TaskSeriesServiceTest {
    private static final String USER_ID = "recurring-task-user";

    @Autowired private TaskSeriesService taskSeriesService;
    @Autowired private TaskSeriesRepository seriesRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .email("recurring@test.com")
                .firstName("Recurring")
                .lastName("Task")
                .username("recurring-task")
                .active(true)
                .build());
    }

    @Test
    void createsConcreteOccurrencesAndExpansionIsIdempotent() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());

        assertEquals(3, occurrences.size());
        assertEquals(first.getTaskId(), occurrences.get(0).getTaskId());
        assertNotNull(seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID).orElse(null));

        taskSeriesService.expandActiveSeries();

        assertEquals(3, taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).size());
    }

    @Test
    void movingOneOccurrenceDoesNotChangeTheSeriesOrOtherOccurrences() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        List<Task> originalOccurrences = taskRepository
                .findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());
        Task second = originalOccurrences.get(1);
        LocalDateTime movedDateTime = second.getScheduledPerformDateTime().plusDays(3);

        UpdateTaskRequest update = new UpdateTaskRequest();
        update.setScheduledPerformDateTime(movedDateTime.toString());
        taskService.updateTask(second.getTaskId(), update, USER_ID);

        List<Task> updatedOccurrences = taskRepository
                .findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());
        assertEquals(start, updatedOccurrences.get(0).getScheduledPerformDateTime());
        assertEquals(movedDateTime, updatedOccurrences.get(1).getScheduledPerformDateTime());
        assertEquals(start.plusDays(2), updatedOccurrences.get(2).getScheduledPerformDateTime());
        assertEquals(start, seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID)
                .orElseThrow().getStartDateTime());
        assertEquals(originalOccurrences.get(1).getSeriesOccurrenceAt(),
                updatedOccurrences.get(1).getSeriesOccurrenceAt());
    }

    @Test
    void seriesExpansionPrependsOccurrencesWithoutChangingTheirEstablishedOrder() {
        Task existingTask = taskService.createTask(
                request(LocalDateTime.now().plusHours(1).withSecond(0).withNano(0)), USER_ID);
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(
                first.getTaskSeriesId());

        assertEquals(3, taskRepository.findTaskByTaskId(existingTask.getTaskId()).orElseThrow().getDisplayOrder());
        assertEquals(List.of(2, 1, 0), occurrences.stream().map(Task::getDisplayOrder).toList());
    }

    @Test
    void completingAnOccurrenceDoesNotCompleteTheSeries() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(1));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        UpdateTaskRequest update = new UpdateTaskRequest();
        update.setCompleted(true);
        taskService.updateTask(first.getTaskId(), update, USER_ID);

        taskSeriesService.expandActiveSeries();

        assertTrue(taskRepository.findTaskByTaskId(first.getTaskId()).orElseThrow().isCompleted());
        assertEquals(2, taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).size());
        assertTrue(seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID).orElseThrow().isActive());
    }

    @Test
    void deletingARecurringTaskPermanentlyDeletesTheWholeSeries() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        Task second = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).get(1);
        List<String> occurrenceIds = taskRepository
                .findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId())
                .stream()
                .map(Task::getTaskId)
                .toList();

        taskService.deleteTask(second.getTaskId(), USER_ID);
        taskSeriesService.expandActiveSeries();

        assertTrue(occurrenceIds.stream().noneMatch(taskId -> taskRepository.findTaskByTaskId(taskId).isPresent()));
        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).isEmpty());
        assertTrue(seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID).isEmpty());
        assertEquals(0, taskService.getAllMainTasks(USER_ID).stream()
                .filter(task -> first.getTaskSeriesId().equals(task.getTaskSeriesId())).count());
    }

    @Test
    void deletingOneOccurrenceKeepsTheSeriesAndOtherOccurrences() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        Task second = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).get(1);

        taskService.deleteTaskOccurrence(second.getTaskId(), USER_ID);
        taskSeriesService.expandActiveSeries();

        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());
        assertEquals(3, occurrences.size());
        assertTrue(second.isSkipped());
        assertEquals(TaskSkipReason.USER, second.getSkipReason());
        assertTrue(seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID).orElseThrow().isActive());
        assertEquals(2, taskService.getAllMainTasks(USER_ID).stream()
                .filter(task -> first.getTaskSeriesId().equals(task.getTaskSeriesId())).count());
    }

    @Test
    void stoppingASeriesKeepsTheAnchorAndHidesFutureOccurrences() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        taskSeriesService.stopSeries(first.getTaskSeriesId(), USER_ID);

        TaskSeries series = seriesRepository.findBySeriesIdAndUserId(first.getTaskSeriesId(), USER_ID).orElseThrow();
        assertFalse(series.isActive());
        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());
        assertFalse(occurrences.get(0).isSkipped());
        assertTrue(occurrences.stream().skip(1).allMatch(Task::isSkipped));
        taskSeriesService.expandActiveSeries();
        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).stream()
                .skip(1)
                .allMatch(Task::isSkipped));
        assertEquals(1, taskService.getAllMainTasks(USER_ID).stream()
                .filter(task -> first.getTaskSeriesId().equals(task.getTaskSeriesId()))
                .count());
    }

    @Test
    void updatingASeriesRestoresRetiredOccurrencesButNotExplicitlySkippedOnes() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        Task second = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId()).get(1);
        second.setSkipped(true);
        second.setSkipReason(TaskSkipReason.USER);
        taskRepository.save(second);

        TaskSeriesUpdateRequest update = new TaskSeriesUpdateRequest();
        update.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        update.setRecurrenceEndDate(start.toLocalDate().plusDays(4));
        update.setTimeZone("UTC");
        taskSeriesService.updateSeries(first.getTaskSeriesId(), update, USER_ID);

        List<Task> occurrences = taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId());
        assertEquals(5, occurrences.size());
        assertTrue(second.isSkipped());
        assertEquals(4, taskService.getAllMainTasks(USER_ID).stream()
                .filter(task -> first.getTaskSeriesId().equals(task.getTaskSeriesId())).count());
    }

    @Test
    void updatingSeriesPriorityChangesEveryMaterializedOccurrence() {
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        NewTaskRequest request = request(start);
        request.setImportance(3);
        request.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        request.setRecurrenceEndDate(start.toLocalDate().plusDays(2));

        Task first = taskSeriesService.createSeries(request, USER_ID);
        TaskSeriesUpdateRequest update = new TaskSeriesUpdateRequest();
        update.setRecurrenceFrequency(TaskRecurrenceFrequency.DAILY);
        update.setRecurrenceEndDate(start.toLocalDate().plusDays(2));
        update.setTimeZone("UTC");
        update.setImportance(9);

        TaskSeriesResponse updated = taskSeriesService.updateSeries(first.getTaskSeriesId(), update, USER_ID);

        assertEquals(9, updated.importance());
        assertTrue(taskRepository.findAllByTaskSeriesIdOrderBySeriesOccurrenceAtAsc(first.getTaskSeriesId())
                .stream().allMatch(task -> task.getImportance() == 9));
    }

    private NewTaskRequest request(LocalDateTime start) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Review recurring work");
        request.setScheduledPerformDateTime(start.toString());
        request.setTimeZone("UTC");
        return request;
    }
}
