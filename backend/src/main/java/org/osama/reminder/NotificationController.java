package org.osama.reminder;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationService notificationService, CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/due")
    public List<NotificationMessage> getDue() {
        return notificationService.getDue(currentUserService.getCurrentUserId());
    }

    @PostMapping("/{notificationId}/acknowledge")
    public ResponseEntity<Void> acknowledge(@PathVariable String notificationId) {
        notificationService.acknowledge(notificationId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
