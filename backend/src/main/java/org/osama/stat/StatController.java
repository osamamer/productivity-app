package org.osama.stat;

import lombok.Data;
import org.osama.task.Task;
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
    private final SecretStatsAccessService secretStatsAccessService;

    public StatController(StatService statService, StatInsightService statInsightService,
                          CurrentUserService currentUserService,
                          SecretStatsAccessService secretStatsAccessService) {
        this.statService = statService;
        this.statInsightService = statInsightService;
        this.currentUserService = currentUserService;
        this.secretStatsAccessService = secretStatsAccessService;
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
                request.recurringTaskImportance,
                request.additionalInputTypes,
                request.unit,
                request.parentDefinitionId,
                currentUserService.getCurrentUserId()
        );
    }

    @GetMapping("/definitions")
    public List<StatDefinition> getDefinitions(
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return statService.getDefinitions(userId, secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @GetMapping("/bootstrap")
    public StatBootstrapResponse getBootstrap(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return statService.getBootstrap(from, to, userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @PostMapping("/secret-access")
    public SecretStatsAccessService.GrantResponse unlockSecretStats(
            @RequestBody SecretStatsAccessRequest request) {
        return secretStatsAccessService.unlock(request == null ? null : request.password,
                currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/secret-access")
    public void lockSecretStats(
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        secretStatsAccessService.lock(currentUserService.getCurrentUserId(), accessToken);
    }

    @DeleteMapping("/definitions/{id}")
    public void deleteDefinition(@PathVariable String id,
                                 @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        statService.deleteDefinition(id, userId);
    }

    @PutMapping("/definitions/{id}")
    public StatDefinition updateDefinition(@PathVariable String id,
                                           @RequestBody UpdateDefinitionRequest request,
                                           @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.updateDefinition(
                id,
                request.name,
                request.description,
                request.morality,
                request.goodThreshold,
                request.additionalInputTypes,
                request.unit,
                request.parentDefinitionId,
                request.isParentDefinitionIdProvided(),
                userId
        );
    }

    @PutMapping("/definitions/{id}/secret")
    public StatDefinition updateSecret(@PathVariable String id,
                                       @RequestBody SecretStatRequest request,
                                       @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        if (request == null || request.secret == null) {
            throw new IllegalArgumentException("Please choose whether the statistic should be secret.");
        }
        return statService.updateSecret(id, request.secret, userId);
    }

    @PutMapping("/definitions/{id}/stats-page-visibility")
    public StatDefinition updateStatsPageVisibility(@PathVariable String id,
                                                   @RequestBody StatsPageVisibilityRequest request,
                                                   @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.updateStatsPageVisibility(
                id, request.showOnStatsPage, userId);
    }

    @PostMapping("/definitions/{id}/recurring-task")
    public StatDefinition createRecurringTask(@PathVariable String id,
                                              @RequestBody(required = false) CreateRecurringTaskRequest request,
                                              @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.createRecurringTask(
                id,
                userId,
                request == null ? null : request.timeZone,
                request == null || request.recurrenceFrequency == null
                        ? org.osama.task.recurrence.TaskRecurrenceFrequency.DAILY
                        : request.recurrenceFrequency,
                request == null ? null : request.recurrenceDaysOfWeek,
                request == null ? null : request.timeOfDay,
                request == null ? null : request.importance,
                request == null ? null : request.taskName
        );
    }

    @GetMapping("/definitions/{id}/recurring-task")
    public TaskSeriesResponse getRecurringTask(@PathVariable String id,
                                               @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.getRecurringTask(id, userId);
    }

    @GetMapping("/definitions/{id}/weekly-task-schedule")
    public StatWeeklyTaskScheduleResponse getWeeklyTaskSchedule(
            @PathVariable String id,
            @RequestParam(required = false) String timeZone,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStartDate,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.getWeeklyTaskSchedule(
                id, timeZone, weekStartDate, userId);
    }

    @PutMapping("/definitions/{id}/weekly-task-schedule")
    public StatWeeklyTaskScheduleResponse replaceWeeklyTaskSchedule(
            @PathVariable String id,
            @RequestBody WeeklyTaskScheduleRequest request,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.replaceWeeklyTaskSchedule(
                id,
                request == null ? null : request.taskName,
                request == null ? null : request.daysOfWeek,
                request == null ? null : request.timeOfDay,
                request == null ? null : request.importance,
                request == null ? null : request.timeZone,
                request == null ? null : request.weekStartDate,
                request == null ? null : request.weekCount,
                userId);
    }

    @PutMapping("/definitions/{id}/recurring-task")
    public StatDefinition updateRecurringTask(@PathVariable String id,
                                              @RequestBody CreateRecurringTaskRequest request,
                                              @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.updateRecurringTask(
                id,
                userId,
                request == null ? null : request.timeZone,
                request == null || request.recurrenceFrequency == null
                        ? TaskRecurrenceFrequency.DAILY : request.recurrenceFrequency,
                request == null ? null : request.recurrenceDaysOfWeek,
                request == null ? null : request.timeOfDay,
                request == null ? null : request.importance,
                request == null ? null : request.taskName
        );
    }

    @DeleteMapping("/definitions/{id}/recurring-task")
    public StatDefinition disconnectRecurringTask(@PathVariable String id,
                                                  @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.disconnectRecurringTask(id, userId);
    }

    @PutMapping("/definitions/{id}/focus-task")
    public StatDefinition linkFocusTask(@PathVariable String id,
                                        @RequestBody LinkFocusTaskRequest request,
                                        @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.linkFocusTask(id, request == null ? null : request.taskName,
                userId);
    }

    @PostMapping("/definitions/{id}/focus-task/start")
    public Task startFocusTask(@PathVariable String id,
                               @RequestBody(required = false) StartFocusTaskRequest request,
                               @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.startFocusTask(
                id,
                request == null ? null : request.taskName,
                request == null ? null : request.importance,
                request == null ? null : request.timeZone,
                request == null ? null : request.scheduledPerformDateTime,
                request == null ? null : request.reminderMinutesBefore,
                userId
        );
    }

    @DeleteMapping("/definitions/{id}/focus-task")
    public StatDefinition unlinkFocusTask(@PathVariable String id,
                                          @RequestBody(required = false) LinkFocusTaskRequest request,
                                          @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.unlinkFocusTask(id, request == null ? null : request.taskName,
                userId);
    }

    @DeleteMapping("/definitions/{id}/recurring-task/series")
    public StatDefinition deleteRecurringTaskSeries(@PathVariable String id,
                                                    @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.deleteRecurringTaskSeries(id, userId);
    }

    @DeleteMapping("/definitions/{id}/recurring-task/future")
    public StatDefinition deleteRecurringTaskFutureOccurrences(@PathVariable String id,
                                                               @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.deleteRecurringTaskFutureOccurrences(id, userId);
    }

    @PutMapping("/definitions/order")
    public List<StatDefinition> reorderDefinitions(@RequestBody ReorderDefinitionsRequest request,
                                                   @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return statService.reorderDefinitions(request.definitionIds, userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    // --- Stat Entries ---

    @PostMapping("/entries")
    public ResponseEntity<StatEntry> recordEntry(@RequestBody RecordEntryRequest request,
                                                 @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(request.statDefinitionId, userId, accessToken);
        LocalDate date = request.date != null ? request.date : LocalDate.now();
        StatEntry entry = statService.recordEntry(
                request.statDefinitionId,
                date,
                request.value,
                request.status,
                request.additionalValues,
                userId
        );
        return entry == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(entry);
    }

    @GetMapping("/entries")
    public List<StatEntry> getEntries(
            @RequestParam String statDefinitionId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(statDefinitionId, userId, accessToken);
        return statService.getEntries(statDefinitionId, from, to, userId);
    }

    @GetMapping("/definitions/{id}/focus-time")
    public List<StatFocusTimeEntryResponse> getFocusTime(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.getFocusTime(id, from, to, userId);
    }

    @GetMapping("/entries/today")
    public List<StatEntry> getTodayEntries(
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return statService.getTodayEntries(userId, secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @GetMapping("/definitions/{id}/summary")
    public StatSummaryResponse getSummary(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statService.getSummary(id, from, to, userId);
    }

    @GetMapping("/definitions/{id}/insights")
    public StatInsightsResponse getInsights(
            @PathVariable String id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        secretStatsAccessService.requireDefinitionAccess(id, userId, accessToken);
        return statInsightService.getInsights(id, from, to, userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @GetMapping("/entries/by-date")
    public List<StatEntry> getEntriesByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return statService.getEntriesByDate(date, userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
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
        Integer recurringTaskImportance;
        List<StatType> additionalInputTypes;
        String unit;
        String parentDefinitionId;
    }

    @Data
    public static class UpdateDefinitionRequest {
        String name;
        String description;
        StatMorality morality;
        Double goodThreshold;
        List<StatType> additionalInputTypes;
        String unit;
        String parentDefinitionId;
        private boolean parentDefinitionIdProvided;

        public void setParentDefinitionId(String parentDefinitionId) {
            this.parentDefinitionId = parentDefinitionId;
            this.parentDefinitionIdProvided = true;
        }

        public boolean isParentDefinitionIdProvided() {
            return parentDefinitionIdProvided;
        }
    }

    @Data
    public static class StatsPageVisibilityRequest {
        boolean showOnStatsPage;
    }

    public record SecretStatsAccessRequest(String password) { }

    public record SecretStatRequest(Boolean secret) { }

    @Data
    public static class RecordEntryRequest {
        String statDefinitionId;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate date;
        Double value;
        StatEntryStatus status;
        java.util.Map<StatType, Double> additionalValues;
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
        Integer importance;
        String taskName;
    }

    @Data
    public static class WeeklyTaskScheduleRequest {
        String taskName;
        List<DayOfWeek> daysOfWeek;
        String timeOfDay;
        Integer importance;
        String timeZone;
        LocalDate weekStartDate;
        Integer weekCount;
    }

    @Data
    public static class LinkFocusTaskRequest {
        String taskName;
    }

    @Data
    public static class StartFocusTaskRequest {
        String taskName;
        Integer importance;
        String timeZone;
        String scheduledPerformDateTime;
        Integer reminderMinutesBefore;
    }
}
