package org.osama.reminder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ExpoPushNotificationService {
    private static final int MAX_MESSAGES_PER_REQUEST = 100;
    private static final String DEFAULT_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final MobilePushTokenRepository tokenRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final boolean enabled;
    private final String pushUrl;
    private final String accessToken;

    public ExpoPushNotificationService(
            MobilePushTokenRepository tokenRepository,
            ObjectMapper objectMapper,
            @Value("${app.notifications.push.enabled:true}") boolean enabled,
            @Value("${app.notifications.push.url:" + DEFAULT_PUSH_URL + "}") String pushUrl,
            @Value("${app.notifications.push.access-token:}") String accessToken) {
        this.tokenRepository = tokenRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.enabled = enabled;
        this.pushUrl = pushUrl;
        this.accessToken = accessToken;
    }

    /**
     * Sends only notifications that have no reliable native alarm equivalent.
     * Calendar, task, and normal daily check-up reminders are scheduled on-device
     * so they still work if the server is temporarily unavailable.
     */
    public boolean send(Reminder reminder) {
        if (!enabled || !requiresRemoteDelivery(reminder)) return true;

        List<MobilePushToken> tokens = tokenRepository.findAllByUserId(reminder.getUserId());
        if (tokens.isEmpty()) return true;

        List<Map<String, Object>> messages = tokens.stream()
                .map(token -> messageFor(reminder, token.getToken()))
                .toList();
        boolean successful = true;
        for (int start = 0; start < messages.size(); start += MAX_MESSAGES_PER_REQUEST) {
            int end = Math.min(start + MAX_MESSAGES_PER_REQUEST, messages.size());
            if (!sendBatch(messages.subList(start, end), tokens.subList(start, end))) {
                successful = false;
            }
        }
        return successful;
    }

    private boolean requiresRemoteDelivery(Reminder reminder) {
        return switch (reminder.getNotificationType()) {
            case POMODORO_FOCUS_ENDED, POMODORO_BREAK_ENDED, POMODORO_COMPLETED -> true;
            case MENTAL_STATE_CHECKUP -> reminder.getReminderId().startsWith("mental-state-checkup-repeat-");
            case CALENDAR_EVENT, TASK_REMINDER -> false;
        };
    }

    private Map<String, Object> messageFor(Reminder reminder, String token) {
        Map<String, Object> data = new HashMap<>();
        data.put("notificationId", reminder.getReminderId());
        data.put("targetUrl", reminder.getTargetUrl());
        data.put("type", reminder.getNotificationType().name());
        if (reminder.getTaskId() != null) data.put("taskId", reminder.getTaskId());

        Map<String, Object> message = new HashMap<>();
        message.put("to", token);
        message.put("title", reminder.getTitle());
        message.put("body", reminder.getBody());
        message.put("data", data);
        message.put("priority", "high");
        message.put("channelId", NotificationService.DEFAULT_CHANNEL_ID);
        message.put("sound", "default");
        return message;
    }

    private boolean sendBatch(List<Map<String, Object>> messages, List<MobilePushToken> tokens) {
        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(pushUrl))
                    .timeout(Duration.ofSeconds(10))
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(messages)));
            if (!accessToken.isBlank()) requestBuilder.header("Authorization", "Bearer " + accessToken);

            HttpResponse<String> response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Expo push delivery failed: status={} tokenCount={}", response.statusCode(), tokens.size());
                return false;
            }
            return inspectTickets(response.body(), tokens);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Expo push delivery was interrupted: tokenCount={}", tokens.size(), e);
            return false;
        } catch (IOException | RuntimeException e) {
            log.warn("Expo push delivery failed: tokenCount={}", tokens.size(), e);
            return false;
        }
    }

    private boolean inspectTickets(String responseBody, List<MobilePushToken> tokens) {
        try {
            JsonNode tickets = objectMapper.readTree(responseBody).path("data");
            if (!tickets.isArray()) return false;
            boolean successful = true;
            for (int index = 0; index < tickets.size() && index < tokens.size(); index++) {
                JsonNode ticket = tickets.get(index);
                if ("DeviceNotRegistered".equals(ticket.path("details").path("error").asText())) {
                    tokenRepository.deleteById(tokens.get(index).getToken());
                } else if ("error".equals(ticket.path("status").asText())) {
                    successful = false;
                    log.warn("Expo rejected a mobile notification ticket: error={} tokenCount={}",
                            ticket.path("details").path("error").asText("unknown"), tokens.size());
                }
            }
            return successful && tickets.size() == tokens.size();
        } catch (IOException | RuntimeException e) {
            log.warn("Could not inspect Expo push delivery tickets", e);
            return false;
        }
    }
}
