package org.osama.task.recurrence;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskSkipReason;
import org.osama.task.TaskService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class TaskSeriesService {
    private static final int OCCURRENCE_LOOKBACK_DAYS = 365;
    private static final int OCCURRENCE_HORIZON_DAYS = 90;

    private final TaskSeriesRepository seriesRepository;
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    public TaskSeriesService(TaskSeriesRepository seriesRepository,
                             TaskRepository taskRepository,
                             TaskService taskService) {
        this.seriesRepository = seriesRepository;
        this.taskRepository = taskRepository;
        this.taskService = taskService;
    }

    @Transactional
    public Task createSeries(NewTaskRequest request, String userId) {
        validateRule(request.getRecurrenceFrequency(), request.getRecurrenceEndDate(),
                request.getRecurrenceInterval(), request.getRecurrenceUnit(), request.getTimeZone(),
                request.getScheduledPerformDateTime());

        if (request.getParentId() != null && !request.getParentId().isBlank()) {
            throw new IllegalArgumentException("Recurring subtasks are not supported yet.");
        }

        Task firstOccurrence = taskService.createTask(request, userId);
        TaskSeries series = createSeriesForTask(firstOccurrence, request.getRecurrenceFrequency(),
                request.getRecurrenceEndDate(), request.getRecurrenceInterval(), request.getRecurrenceUnit(),
                request.getTimeZone());
        attachOccurrence(firstOccurrence, series, firstOccurrence.getScheduledPerformDateTime());
        materializeOccurrences(series, userId);
        log.info("Task series created: userId={} seriesId={} firstTaskId={} frequency={}",
                userId, series.getSeriesId(), firstOccurrence.getTaskId(), series.getRecurrenceFrequency());
        return firstOccurrence;
    }

    @Transactional
    public TaskSeriesResponse createSeriesFromTask(String taskId, TaskSeriesRuleRequest request, String userId) {
        Task task = taskService.getTaskForUserOrThrow(taskId, userId);
        if (task.getParentId() != null) {
            throw new IllegalArgumentException("Recurring subtasks are not supported yet.");
        }
        if (task.getTaskSeriesId() != null) {
            return getSeries(task.getTaskSeriesId(), userId);
        }
        if (task.getScheduledPerformDateTime() == null) {
            throw new IllegalArgumentException("A recurring task needs a scheduled date and time.");
        }

        validateRule(request.getRecurrenceFrequency(), request.getRecurrenceEndDate(),
                request.getRecurrenceInterval(), request.getRecurrenceUnit(), request.getTimeZone(),
                task.getScheduledPerformDateTime().toString());
        TaskSeries series = createSeriesForTask(task, request.getRecurrenceFrequency(), request.getRecurrenceEndDate(),
                request.getRecurrenceInterval(), request.getRecurrenceUnit(), request.getTimeZone());
        attachOccurrence(task, series, task.getScheduledPerformDateTime());
        materializeOccurrences(series, userId);
        log.info("Task converted to recurring series: userId={} taskId={} seriesId={}",
                userId, taskId, series.getSeriesId());
        return toResponse(series);
    }

    @Transactional(readOnly = true)
    public TaskSeriesResponse getSeries(String seriesId, String userId) {
        return toResponse(seriesRepository.findBySeriesIdAndUserId(seriesId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task series not found: " + seriesId)));
    }

    @Transactional(readOnly = true)
    public Optional<TaskSeriesResponse> getSeriesForTask(String taskId, String userId) {
        return taskService.getTaskForUser(taskId, userId)
                .filter(task -> task.getTaskSeriesId() != null)
                .map(task -> getSeries(task.getTaskSeriesId(), userId));
    }

    @Transactional
    public TaskSeriesResponse updateSeries(String seriesId, TaskSeriesUpdateRequest request, String userId) {
        TaskSeries series = seriesRepository.lockBySeriesIdAndUserId(seriesId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task series not found: " + seriesId));

        TaskRecurrenceFrequency frequency = request.getRecurrenceFrequency() == null
                ? series.getRecurrenceFrequency() : request.getRecurrenceFrequency();
        String timeZone = request.getTimeZone() == null ? series.getTimeZone() : request.getTimeZone();
        validateRule(frequency, request.getRecurrenceEndDate(), request.getRecurrenceInterval(),
                request.getRecurrenceUnit(), timeZone, series.getStartDateTime().toString());

        skipFutureOccurrences(series.getSeriesId(), TaskSkipReason.SERIES_CHANGED);
        series.setRecurrenceFrequency(frequency);
        series.setRecurrenceEndDate(request.getRecurrenceEndDate());
        series.setRecurrenceInterval(frequency == TaskRecurrenceFrequency.CUSTOM
                ? request.getRecurrenceInterval() : null);
        series.setRecurrenceUnit(frequency == TaskRecurrenceFrequency.CUSTOM
                ? request.getRecurrenceUnit() : null);
        series.setTimeZone(timeZone);
        if (request.getActive() != null) {
            series.setActive(request.getActive());
        }
        TaskSeries saved = seriesRepository.save(series);
        if (saved.isActive()) {
            materializeOccurrences(saved, userId);
        }
        log.info("Task series updated: userId={} seriesId={} active={} frequency={}",
                userId, seriesId, saved.isActive(), saved.getRecurrenceFrequency());
        return toResponse(saved);
    }

    @Transactional
    public void stopSeries(String seriesId, String userId) {
        TaskSeries series = seriesRepository.lockBySeriesIdAndUserId(seriesId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task series not found: " + seriesId));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime futureOccurrenceBoundary = series.getStartDateTime().isAfter(now)
                ? series.getStartDateTime()
                : now;
        // Keep the series anchor as the ordinary task that remains after repeat is disabled.
        skipOccurrencesAfter(series.getSeriesId(), futureOccurrenceBoundary, TaskSkipReason.SERIES_STOPPED);
        series.setActive(false);
        seriesRepository.save(series);
        log.info("Task series stopped and future occurrences hidden: userId={} seriesId={}", userId, seriesId);
    }

    @Scheduled(
            fixedDelayString = "${app.task-series.expansion-delay-ms:21600000}",
            initialDelayString = "${app.task-series.expansion-initial-delay-ms:10000}"
    )
    @Transactional
    public void expandActiveSeries() {
        for (TaskSeries series : seriesRepository.findAllByActiveTrue()) {
            try {
                materializeOccurrences(series, series.getUserId());
            } catch (RuntimeException exception) {
                log.error("Task series expansion failed: seriesId={} userId={}",
                        series.getSeriesId(), series.getUserId(), exception);
            }
        }
    }

    private TaskSeries createSeriesForTask(Task task,
                                           TaskRecurrenceFrequency frequency,
                                           LocalDate endDate,
                                           Integer interval,
                                           TaskRecurrenceUnit unit,
                                           String timeZone) {
        TaskSeries series = new TaskSeries();
        series.setSeriesId(UUID.randomUUID().toString());
        series.setUser(task.getUser());
        series.setName(task.getName());
        series.setDescription(task.getDescription());
        series.setTag(task.getTag());
        series.setImportance(task.getImportance());
        series.setMentalThreadId(task.getMentalThreadId());
        series.setStartDateTime(task.getScheduledPerformDateTime());
        series.setRecurrenceFrequency(frequency);
        series.setRecurrenceEndDate(endDate);
        series.setRecurrenceInterval(frequency == TaskRecurrenceFrequency.CUSTOM ? interval : null);
        series.setRecurrenceUnit(frequency == TaskRecurrenceFrequency.CUSTOM ? unit : null);
        series.setTimeZone(normalizeTimeZone(timeZone));
        series.setReminderMinutesBefore(task.getReminderMinutesBefore());
        series.setActive(true);
        return seriesRepository.save(series);
    }

    private void materializeOccurrences(TaskSeries series, String userId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime from = now.minusDays(OCCURRENCE_LOOKBACK_DAYS);
        if (series.getStartDateTime().isAfter(from)) {
            from = series.getStartDateTime();
        }
        LocalDateTime through = now.plusDays(OCCURRENCE_HORIZON_DAYS);
        List<LocalDateTime> occurrenceDates = TaskRecurrenceCalculator.occurrencesBetween(series, from, through);

        for (LocalDateTime occurrenceDate : occurrenceDates) {
            Optional<Task> existingOccurrence = taskRepository.findByTaskSeriesIdAndSeriesOccurrenceAt(
                    series.getSeriesId(), occurrenceDate);
            if (existingOccurrence.isPresent()) {
                Task existingTask = existingOccurrence.get();
                if (existingTask.isSkipped() && existingTask.getSkipReason() != TaskSkipReason.USER) {
                    existingTask.setSkipped(false);
                    existingTask.setSkipReason(null);
                    taskRepository.save(existingTask);
                }
                continue;
            }
            NewTaskRequest occurrenceRequest = new NewTaskRequest();
            occurrenceRequest.setName(series.getName());
            occurrenceRequest.setDescription(series.getDescription());
            occurrenceRequest.setScheduledPerformDateTime(occurrenceDate.toString());
            occurrenceRequest.setTag(series.getTag());
            occurrenceRequest.setImportance(series.getImportance());
            occurrenceRequest.setMentalThreadId(series.getMentalThreadId());
            occurrenceRequest.setTimeZone(series.getTimeZone());
            occurrenceRequest.setReminderMinutesBefore(series.getReminderMinutesBefore());

            Task occurrence = taskService.createTaskFromSeries(occurrenceRequest, userId);
            attachOccurrence(occurrence, series, occurrenceDate);
        }
    }

    private void attachOccurrence(Task task, TaskSeries series, LocalDateTime occurrenceDate) {
        task.setTaskSeriesId(series.getSeriesId());
        task.setSeriesOccurrenceAt(occurrenceDate);
        taskRepository.save(task);
    }

    private void skipFutureOccurrences(String seriesId, TaskSkipReason reason) {
        skipOccurrencesAfter(seriesId, LocalDateTime.now(), reason);
    }

    private void skipOccurrencesAfter(String seriesId, LocalDateTime boundary, TaskSkipReason reason) {
        List<Task> futureOccurrences = taskRepository.findAllByTaskSeriesIdAndSeriesOccurrenceAtAfter(seriesId, boundary);
        futureOccurrences.stream()
                .filter(task -> !task.isCompleted() && !task.isSkipped())
                .forEach(task -> {
                    task.setSkipped(true);
                    task.setSkipReason(reason);
                });
        taskRepository.saveAll(futureOccurrences);
    }

    private void validateRule(TaskRecurrenceFrequency frequency,
                              LocalDate endDate,
                              Integer interval,
                              TaskRecurrenceUnit unit,
                              String timeZone,
                              String startDateTime) {
        if (frequency == null) {
            throw new IllegalArgumentException("A recurrence frequency is required.");
        }

        LocalDateTime start;
        try {
            start = LocalDateTime.parse(startDateTime);
        } catch (DateTimeParseException | NullPointerException exception) {
            throw new IllegalArgumentException("A recurring task needs a scheduled date and time.", exception);
        }
        if (endDate != null && endDate.isBefore(start.toLocalDate())) {
            throw new IllegalArgumentException("A recurring task must end on or after its start date.");
        }
        if (frequency == TaskRecurrenceFrequency.CUSTOM
                && (interval == null || interval < 1 || interval > 999 || unit == null)) {
            throw new IllegalArgumentException("A custom recurrence needs an interval between 1 and 999 and a unit.");
        }
        try {
            ZoneId.of(normalizeTimeZone(timeZone));
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("The task time zone is invalid.", exception);
        }
    }

    private String normalizeTimeZone(String timeZone) {
        return timeZone == null || timeZone.isBlank() ? ZoneId.systemDefault().getId() : timeZone;
    }

    private TaskSeriesResponse toResponse(TaskSeries series) {
        return new TaskSeriesResponse(
                series.getSeriesId(), series.getName(), series.getDescription(), series.getTag(),
                series.getImportance(), series.getMentalThreadId(), series.getStartDateTime(),
                series.getRecurrenceFrequency(), series.getRecurrenceEndDate(), series.getRecurrenceInterval(),
                series.getRecurrenceUnit(), series.getTimeZone(), series.getReminderMinutesBefore(), series.isActive(),
                series.getCreatedAt(), series.getUpdatedAt());
    }
}
