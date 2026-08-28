package org.osama.mentalthread;

import javax.validation.Valid;
import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/mental-threads")
public class MentalThreadController {
    private final CurrentUserService currentUserService;
    private final MentalThreadService mentalThreadService;

    public MentalThreadController(CurrentUserService currentUserService,
                                  MentalThreadService mentalThreadService) {
        this.currentUserService = currentUserService;
        this.mentalThreadService = mentalThreadService;
    }

    @GetMapping
    public List<MentalThreadResponse> getThreads(
            @RequestParam(defaultValue = "false") boolean includeClosed) {
        return mentalThreadService.getThreads(currentUserService.getCurrentUserId(), includeClosed);
    }

    @GetMapping("/{threadId}")
    public MentalThreadResponse getThread(@PathVariable String threadId) {
        return mentalThreadService.getThread(threadId, currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<MentalThreadResponse> createThread(
            @Valid @RequestBody CreateMentalThreadRequest request) {
        MentalThreadResponse mentalThread = mentalThreadService.createThread(
                request, currentUserService.getCurrentUserId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(mentalThread.id())
                .toUri();
        return ResponseEntity.created(location).body(mentalThread);
    }

    @PutMapping("/{threadId}")
    public MentalThreadResponse updateThread(@PathVariable String threadId,
                                             @Valid @RequestBody UpdateMentalThreadRequest request) {
        return mentalThreadService.updateThread(threadId, request, currentUserService.getCurrentUserId());
    }

    @PostMapping("/{threadId}/close")
    public MentalThreadResponse closeThread(@PathVariable String threadId,
                                            @Valid @RequestBody CloseMentalThreadRequest request) {
        return mentalThreadService.closeThread(threadId, request, currentUserService.getCurrentUserId());
    }

    @PostMapping("/{threadId}/reopen")
    public MentalThreadResponse reopenThread(@PathVariable String threadId) {
        return mentalThreadService.reopenThread(threadId, currentUserService.getCurrentUserId());
    }

    @GetMapping("/{threadId}/load-history")
    public List<MentalThreadLoadEntryResponse> getLoadHistory(@PathVariable String threadId) {
        return mentalThreadService.getLoadHistory(threadId, currentUserService.getCurrentUserId());
    }

    @GetMapping("/summary")
    public MentalThreadSummaryResponse getSummary() {
        return mentalThreadService.getSummary(currentUserService.getCurrentUserId());
    }

    @PutMapping("/capacity/today")
    public CapacityCheckInResponse checkInCapacity(@Valid @RequestBody CapacityCheckInRequest request) {
        return mentalThreadService.checkInCapacity(request.capacity(), currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{threadId}")
    public ResponseEntity<Void> deleteThread(@PathVariable String threadId) {
        mentalThreadService.deleteThread(threadId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
