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
    private final CurrentUserService currentUserService;

    public StatController(StatService statService, CurrentUserService currentUserService) {
        this.statService = statService;
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
                currentUserService.getCurrentUserId()
        );
    }

    @GetMapping("/definitions")
    public List<StatDefinition> getDefinitions() {
        return statService.getDefinitions(currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/definitions/{id}")
    public void deleteDefinition(@PathVariable String id) {
        statService.deleteDefinition(id, currentUserService.getCurrentUserId());
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
    public StatSummaryResponse getSummary(@PathVariable String id) {
        return statService.getSummary(id, currentUserService.getCurrentUserId());
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
    }

    @Data
    public static class RecordEntryRequest {
        String statDefinitionId;
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate date;
        double value;
    }
}
