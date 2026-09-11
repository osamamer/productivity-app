package org.osama.stat;

import lombok.Data;
import org.osama.user.CurrentUserService;
import org.osama.task.recurrence.TaskSeriesResponse;
import org.osama.task.recurrence.TaskRecurrenceFrequency;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.DayOfWeek;
import java.util.List;

@RestController
@RequestMapping("/api/v1/stats")
public class StatController {

    private final StatService statService;
    private final StatInsightService statInsightService;
    private final CurrentUserService currentUserService;

    public StatController(StatService statService, StatInsightService statInsightService,
                          CurrentUserService currentUserService) {
        this.statService = statService;
        this.statInsightService = statInsightService;
        this.currentUserService = currentUserService;
    }

    // --- Stat Definitions ---

    @PostMapping("/definitions")
    public StatDefinition createDefinition(@RequestBody CreateDefinitionRequest request) {
        return statService.createDefinition(
                request.name,
                request.description,
                request.type,
                request.minValue,
                request.maxValue,
                request.morality,
                request.goodThreshold,
                request.createRecurringTask,
                request.recurrenceFrequency,
                request.recurrenceDaysOfWeek,
                request.timeOfDay,
                currentUserService.getCurrentUserId()
        );
    }

    @GetMapping("/definitions")
    public List<StatDefinition> getDefinitions() {
        return statService.getDefinitions(currentUserService.getCurrentUserId());
    }

    @GetMapping("/bootstrap")
    public StatBootstrapResponse getBootstrap(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statService.getBootstrap(from, to, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/definitions/{id}")
    public void deleteDefinition(@PathVariable String id) {
        statService.deleteDefinition(id, currentUserService.getCurrentUserId());
    }

    @PutMapping("/definitions/{id}")
    public StatDefinition updateDefinition(@PathVariable String id,
                                           @RequestBody UpdateDefinitionRequest request) {
        return statService.updateDefinition(
                id,
                request.name,
                request.description,
                request.morality,
                request.goodThreshold,
                currentUserService.getCurrentUserId()
        );
    }

    @PostMapping("/definitions/{id}/recurring-task")
    public StatDefinition createRecurringTask(@PathVariable String id,
                                              @RequestBody(required = false) CreateRecurringTaskRequest request) {
        return statService.createRecurringTask(
                id,
                currentUserService.getCurrentUserId(),
                request == null ? null : request.timeZone,
                request == null || request.recurrenceFrequency == null
                        ? org.osama.task.recurrence.TaskRecurrenceFrequency.DAILY
                        : request.recurrenceFrequency,
                request == null ? null : request.recurrenceDaysOfWeek,
                request == null ? null : request.timeOfDay
        );
    }

    @GetMapping("/definitions/{id}/recurring-task")
    public TaskSeriesResponse getRecurringTask(@PathVariable String id) {
        return statService.getRecurringTask(id, currentUserService.getCurrentUserId());
    }

    @PutMapping("/definitions/{id}/recurring-task")
    public StatDefinition updateRecurringTask(@PathVariable String id,
                                              @RequestBody CreateRecurringTaskRequest request) {
        return statService.updateRecurringTask(
                id,
                currentUserService.getCurrentUserId(),
                request == null ? null : request.timeZone,
                request == null || request.recurrenceFrequency == null
                        ? TaskRecurrenceFrequency.DAILY : request.recurrenceFrequency,
                request == null ? null : request.recurrenceDaysOfWeek,
                request == null ? null : request.timeOfDay
        );
    }

    @DeleteMapping("/definitions/{id}/recurring-task")
    public StatDefinition disconnectRecurringTask(@PathVariable String id) {
        return statService.disconnectRecurringTask(id, currentUserService.getCurrentUserId());
    }

    @PutMapping("/definitions/{id}/focus-task")
    public StatDefinition linkFocusTask(@PathVariable String id,
                                        @RequestBody LinkFocusTaskRequest request) {
        return statService.linkFocusTask(id, request == null ? null : request.taskName,
                currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/definitions/{id}/focus-task")
    public StatDefinition unlinkFocusTask(@PathVariable String id) {
        return statService.unlinkFocusTask(id, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/definitions/{id}/recurring-task/series")
    public StatDefinition deleteRecurringTaskSeries(@PathVariable String id) {
        return statService.deleteRecurringTaskSeries(id, currentUserService.getCurrentUserId());
    }

    @PutMapping("/definitions/order")
    public List<StatDefinition> reorderDefinitions(@RequestBody ReorderDefinitionsRequest request) {
        return statService.reorderDefinitions(request.definitionIds,
                currentUserService.getCurrentUserId());
    }

    // --- Stat Entries ---

    @PostMapping("/entries")
    public ResponseEntity<StatEntry> recordEntry(@RequestBody RecordEntryRequest request) {
        LocalDate date = request.date != null ? request.date : LocalDate.now();
        StatEntry entry = statService.recordEntry(
                request.statDefinitionId,
                date,
                request.value,
                request.status,
                currentUserService.getCurrentUserId()
        );
        return entry == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(entry);
    }

    @GetMapping("/entries")
    public List<StatEntry> getEntries(
            @RequestParam String statDefinitionId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statService.getEntries(statDefinitionId, from, to, currentUserService.getCurrentUserId());
    }

    @GetMapping("/definitions/{id}/focus-time")
    public List<StatFocusTimeEntryResponse> getFocusTime(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statService.getFocusTime(id, from, to, currentUserService.getCurrentUserId());
    }

    @GetMapping("/entries/today")
    public List<StatEntry> getTodayEntries() {
        return statService.getTodayEntries(currentUserService.getCurrentUserId());
    }

    @GetMapping("/definitions/{id}/summary")
    public StatSummaryResponse getSummary(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statService.getSummary(id, from, to, currentUserService.getCurrentUserId());
    }

    @GetMapping("/definitions/{id}/insights")
    public StatInsightsResponse getInsights(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statInsightService.getInsights(id, from, to, currentUserService.getCurrentUserId());
    }

    @GetMapping("/entries/by-date")
    public List<StatEntry> getEntriesByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return statService.getEntriesByDate(date, currentUserService.getCurrentUserId());
    }

    // --- Request bodies ---

    @Data
    public static class CreateDefinitionRequest {
        String name;
        String description;
        StatType type;
        Double minValue;
        Double maxValue;
        StatMorality morality;
        Double goodThreshold;
        boolean createRecurringTask;
        org.osama.task.recurrence.TaskRecurrenceFrequency recurrenceFrequency;
        List<DayOfWeek> recurrenceDaysOfWeek;
        String timeOfDay;
    }

    @Data
    public static class UpdateDefinitionRequest {
        String name;
        String description;
        StatMorality morality;
        Double goodThreshold;
    }

    @Data
    public static class RecordEntryRequest {
        String statDefinitionId;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate date;
        Double value;
        StatEntryStatus status;
    }

    @Data
    public static class ReorderDefinitionsRequest {
        List<String> definitionIds;
    }

    @Data
    public static class CreateRecurringTaskRequest {
        String timeZone;
        org.osama.task.recurrence.TaskRecurrenceFrequency recurrenceFrequency;
        List<DayOfWeek> recurrenceDaysOfWeek;
        String timeOfDay;
    }

    @Data
    public static class LinkFocusTaskRequest {
        String taskName;
    }
}
