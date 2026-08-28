package org.osama.reminder;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/reminders")
public class ReminderController {
    private final ReminderService reminderService;
    private final CurrentUserService currentUserService;

    public ReminderController(ReminderService reminderService, CurrentUserService currentUserService) {
        this.reminderService = reminderService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/pending")
    public List<ReminderNotification> getPending() {
        return reminderService.getPending(currentUserService.getCurrentUserId());
    }

    @PostMapping("/{reminderId}/acknowledge")
    public ResponseEntity<Void> acknowledge(@PathVariable String reminderId) {
        reminderService.acknowledge(reminderId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
