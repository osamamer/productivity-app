package org.osama.event;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/events")
public class CalendarEventController {
    private final CalendarEventService eventService;
    private final CurrentUserService currentUserService;

    public CalendarEventController(CalendarEventService eventService, CurrentUserService currentUserService) {
        this.eventService = eventService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<CalendarEventResponse> getEvents() {
        return eventService.getEvents(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<CalendarEventResponse> createEvent(@RequestBody CalendarEventRequest request) {
        CalendarEventResponse event = eventService.createEvent(request, currentUserService.getCurrentUserId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(event.id()).toUri();
        return ResponseEntity.created(location).body(event);
    }

    @PutMapping("/{eventId}")
    public CalendarEventResponse updateEvent(@PathVariable String eventId,
                                             @RequestBody CalendarEventRequest request) {
        return eventService.updateEvent(eventId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<Void> deleteEvent(@PathVariable String eventId) {
        eventService.deleteEvent(eventId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
