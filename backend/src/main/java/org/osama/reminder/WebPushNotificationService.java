package org.osama.reminder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Encoding;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.apache.http.HttpResponse;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.nio.client.CloseableHttpAsyncClient;
import org.apache.http.impl.nio.client.HttpAsyncClients;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.GeneralSecurityException;
import java.security.Security;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class WebPushNotificationService {
    private static final int DEFAULT_TTL_SECONDS = (int) Duration.ofDays(1).toSeconds();
    private static final int CHECKUP_TTL_SECONDS = (int) Duration.ofMinutes(30).toSeconds();

    private final WebPushSubscriptionService subscriptionService;
    private final ObjectMapper objectMapper;
    private final PushService pushService;
    private final String publicKey;

    public WebPushNotificationService(
            WebPushSubscriptionService subscriptionService,
            ObjectMapper objectMapper,
            @Value("${app.notifications.web-push.vapid.public-key:}") String publicKey,
            @Value("${app.notifications.web-push.vapid.private-key:}") String privateKey,
            @Value("${app.notifications.web-push.vapid.subject:mailto:notifications@example.com}") String subject) {
        this.subscriptionService = subscriptionService;
        this.objectMapper = objectMapper;
        this.publicKey = publicKey == null ? "" : publicKey.trim();

        if (this.publicKey.isBlank() && (privateKey == null || privateKey.isBlank())) {
            this.pushService = null;
            return;
        }
        if (this.publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            throw new IllegalStateException("Both Web Push VAPID keys must be configured together");
        }

        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        try {
            this.pushService = new PushService(this.publicKey, privateKey.trim(), subject.trim());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Web Push VAPID keys are invalid", e);
        }
    }

    public boolean isConfigured() {
        return pushService != null;
    }

    public String getPublicKey() {
        return publicKey;
    }

    public boolean send(Reminder reminder) {
        if (!isConfigured()) return true;

        List<WebPushSubscription> subscriptions = subscriptionService.findAllByUserId(reminder.getUserId());
        if (subscriptions.isEmpty()) return true;

        final byte[] payload;
        try {
            payload = objectMapper.writeValueAsBytes(NotificationMessage.from(reminder));
        } catch (JsonProcessingException e) {
            log.error("Could not serialize browser notification: userId={} notificationId={}",
                    reminder.getUserId(), reminder.getReminderId(), e);
            return false;
        }

        int ttl = reminder.getNotificationType() == NotificationType.MENTAL_STATE_CHECKUP
                ? CHECKUP_TTL_SECONDS
                : DEFAULT_TTL_SECONDS;
        boolean accepted = true;
        int acceptedCount = 0;
        for (WebPushSubscription subscription : subscriptions) {
            try {
                HttpResponse response = send(new Notification(
                        subscription.getEndpoint(),
                        subscription.getP256dhKey(),
                        subscription.getAuthSecret(),
                        payload,
                        ttl));
                int status = response.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    subscriptionService.remove(subscription);
                    log.info("Expired browser push subscription removed: userId={} subscriptionId={}",
                            reminder.getUserId(), subscription.getId());
                } else if (status < 200 || status >= 300) {
                    accepted = false;
                    log.warn("Browser push delivery failed: userId={} notificationId={} status={}",
                            reminder.getUserId(), reminder.getReminderId(), status);
                } else {
                    acceptedCount++;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                accepted = false;
                log.warn("Browser push delivery was interrupted: userId={} notificationId={}",
                        reminder.getUserId(), reminder.getReminderId(), e);
                break;
            } catch (Exception e) {
                accepted = false;
                log.warn("Browser push delivery failed: userId={} notificationId={}",
                        reminder.getUserId(), reminder.getReminderId(), e);
            }
        }
        if (acceptedCount > 0) {
            log.info("Browser push notification accepted: userId={} notificationId={} subscriptionCount={}",
                    reminder.getUserId(), reminder.getReminderId(), acceptedCount);
        }
        return accepted;
    }

    private HttpResponse send(Notification notification) throws Exception {
        RequestConfig requestConfig = RequestConfig.custom()
                .setConnectTimeout((int) Duration.ofSeconds(5).toMillis())
                .setConnectionRequestTimeout((int) Duration.ofSeconds(5).toMillis())
                .setSocketTimeout((int) Duration.ofSeconds(10).toMillis())
                .build();
        try (CloseableHttpAsyncClient httpClient = HttpAsyncClients.custom()
                .setDefaultRequestConfig(requestConfig)
                .build()) {
            httpClient.start();
            HttpPost request = pushService.preparePost(notification, Encoding.AES128GCM);
            return httpClient.execute(request, null).get(10, TimeUnit.SECONDS);
        }
    }
}
