package org.osama.reminder;

import org.osama.user.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final MobilePushTokenService mobilePushTokenService;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationService notificationService,
                                  MobilePushTokenService mobilePushTokenService,
                                  CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.mobilePushTokenService = mobilePushTokenService;
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

    @PostMapping("/push-token")
    public ResponseEntity<Void> registerPushToken(@RequestBody MobilePushTokenRequest request) {
        if (request == null || !mobilePushTokenService.isValid(request.token())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid push token");
        }
        mobilePushTokenService.register(currentUserService.getCurrentUser(), request.token());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/push-token")
    public ResponseEntity<Void> removePushTokens() {
        mobilePushTokenService.removeForUser(currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
