package org.osama.calendar;

import org.osama.user.CurrentUserService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/v1/calendar-sources")
public class CalendarSourceController {
    private final CalendarSourceService sources;
    private final CurrentUserService users;

    public CalendarSourceController(CalendarSourceService sources, CurrentUserService users) {
        this.sources = sources;
        this.users = users;
    }

    @GetMapping
    public List<CalendarSourceResponse> list() {
        return sources.list(users.getCurrentUserId());
    }

    @PostMapping("/url")
    public CalendarSourceResponse subscribe(@RequestBody SubscribeCalendarRequest request) {
        return sources.addUrl(users.getCurrentUserId(), request.name(), request.color(), request.url());
    }

    @PostMapping("/file")
    public CalendarSourceResponse upload(@RequestParam String name, @RequestParam String color,
                                         @RequestParam MultipartFile file) throws IOException {
        if (file.getSize() > IcsFeedClient.MAX_BYTES) throw new IllegalArgumentException("Calendar file is too large.");
        return sources.addFile(users.getCurrentUserId(), name, color, file.getBytes());
    }

    @PostMapping("/{sourceId}/sync")
    public CalendarSourceResponse sync(@PathVariable String sourceId) {
        return sources.sync(users.getCurrentUserId(), sourceId);
    }

    public record SubscribeCalendarRequest(String name, String color, String url) { }
}
