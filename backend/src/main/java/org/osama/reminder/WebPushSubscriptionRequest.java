package org.osama.reminder;

public record WebPushSubscriptionRequest(String endpoint, Keys keys) {
    public record Keys(String p256dh, String auth) {
    }
}
