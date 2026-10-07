package org.osama.calendar;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/calendars")
public class CalendarController {
    private final CalendarService calendarService;
    private final CurrentUserService currentUserService;

    public CalendarController(CalendarService calendarService, CurrentUserService currentUserService) {
        this.calendarService = calendarService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<CalendarResponse> getCalendars() {
        return calendarService.getCalendars(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<CalendarResponse> createCalendar(@RequestBody CreateCalendarRequest request) {
        CalendarResponse calendar = calendarService.createCalendar(request, currentUserService.getCurrentUserId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(calendar.id()).toUri();
        return ResponseEntity.created(location).body(calendar);
    }

    @PatchMapping("/{calendarId}")
    public CalendarResponse updateCalendar(@PathVariable String calendarId,
                                           @RequestBody UpdateCalendarRequest request) {
        return calendarService.updateCalendar(calendarId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{calendarId}")
    public ResponseEntity<Void> deleteCalendar(@PathVariable String calendarId) {
        calendarService.deleteCalendar(calendarId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
