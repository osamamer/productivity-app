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
    private final WebPushNotificationService webPushNotificationService;
    private final WebPushSubscriptionService webPushSubscriptionService;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationService notificationService,
                                  MobilePushTokenService mobilePushTokenService,
                                  WebPushNotificationService webPushNotificationService,
                                  WebPushSubscriptionService webPushSubscriptionService,
                                  CurrentUserService currentUserService) {
        this.notificationService = notificationService;
        this.mobilePushTokenService = mobilePushTokenService;
        this.webPushNotificationService = webPushNotificationService;
        this.webPushSubscriptionService = webPushSubscriptionService;
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

    @GetMapping("/web-push/public-key")
    public ResponseEntity<WebPushPublicKeyResponse> getWebPushPublicKey() {
        if (!webPushNotificationService.isConfigured()) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        return ResponseEntity.ok(new WebPushPublicKeyResponse(webPushNotificationService.getPublicKey()));
    }

    @PostMapping("/web-push/subscription")
    public ResponseEntity<Void> registerWebPushSubscription(@RequestBody WebPushSubscriptionRequest request) {
        if (!webPushNotificationService.isConfigured()) return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        if (!webPushSubscriptionService.isValid(request)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid browser push subscription");
        }
        webPushSubscriptionService.register(currentUserService.getCurrentUser(), request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/web-push/subscription")
    public ResponseEntity<Void> removeWebPushSubscription(@RequestBody WebPushSubscriptionRequest request) {
        if (request == null || !webPushSubscriptionService.isValidEndpoint(request.endpoint())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid browser push subscription");
        }
        webPushSubscriptionService.remove(request.endpoint(), currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/web-push/acknowledge")
    public ResponseEntity<Void> acknowledgeWebPush(@RequestBody WebPushAcknowledgeRequest request) {
        if (request != null && request.notificationId() != null
                && !request.notificationId().isBlank() && request.notificationId().length() <= 255) {
            String userId = webPushSubscriptionService.findUserIdForEndpoint(request.endpoint());
            if (userId != null) notificationService.acknowledge(request.notificationId(), userId);
        }
        return ResponseEntity.noContent().build();
    }
}
