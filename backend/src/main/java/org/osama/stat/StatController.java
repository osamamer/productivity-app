package org.osama.stat;

import lombok.Data;
import org.osama.user.CurrentUserService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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

    @PutMapping("/definitions/order")
    public List<StatDefinition> reorderDefinitions(@RequestBody ReorderDefinitionsRequest request) {
        return statService.reorderDefinitions(request.definitionIds,
                currentUserService.getCurrentUserId());
    }

    // --- Stat Entries ---

    @PostMapping("/entries")
    public StatEntry recordEntry(@RequestBody RecordEntryRequest request) {
        LocalDate date = request.date != null ? request.date : LocalDate.now();
        return statService.recordEntry(
                request.statDefinitionId,
                date,
                request.value,
                currentUserService.getCurrentUserId()
        );
    }

    @GetMapping("/entries")
    public List<StatEntry> getEntries(
            @RequestParam String statDefinitionId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return statService.getEntries(statDefinitionId, from, to, currentUserService.getCurrentUserId());
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
        double value;
    }

    @Data
    public static class ReorderDefinitionsRequest {
        List<String> definitionIds;
    }
}
