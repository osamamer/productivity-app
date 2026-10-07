package org.osama.reminder;

public record WebPushAcknowledgeRequest(String notificationId, String endpoint) {
}
