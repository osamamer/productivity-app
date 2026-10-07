package org.osama.reminder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushSubscriptionService {
    private static final int MAX_ENDPOINT_LENGTH = 2048;
    private static final List<String> PUSH_SERVICE_HOSTS = List.of(
            "fcm.googleapis.com",
            "push.services.mozilla.com",
            "push.apple.com",
            "notify.windows.com"
    );

    private final WebPushSubscriptionRepository subscriptionRepository;

    public boolean isValid(WebPushSubscriptionRequest request) {
        if (request == null || !isValidEndpoint(request.endpoint()) || request.keys() == null) return false;
        return hasDecodedLength(request.keys().p256dh(), 65)
                && hasDecodedLength(request.keys().auth(), 16);
    }

    public boolean isValidEndpoint(String endpoint) {
        return endpoint != null && endpoint.length() <= MAX_ENDPOINT_LENGTH && isKnownHttpsPushEndpoint(endpoint);
    }

    @Transactional
    public void register(User user, WebPushSubscriptionRequest request) {
        if (!isValid(request)) throw new IllegalArgumentException("Invalid browser push subscription");

        WebPushSubscription subscription = subscriptionRepository.findByEndpoint(request.endpoint())
                .orElseGet(WebPushSubscription::new);
        subscription.setEndpoint(request.endpoint());
        subscription.setP256dhKey(request.keys().p256dh());
        subscription.setAuthSecret(request.keys().auth());
        subscription.setUser(user);
        WebPushSubscription saved = subscriptionRepository.save(subscription);
        log.info("Browser push subscription registered: userId={} subscriptionId={}", user.getId(), saved.getId());
    }

    @Transactional
    public void remove(String endpoint, String userId) {
        subscriptionRepository.findByEndpointAndUserId(endpoint, userId)
                .ifPresent(subscription -> {
                    subscriptionRepository.delete(subscription);
                    log.info("Browser push subscription removed: userId={} subscriptionId={}", userId,
                            subscription.getId());
                });
    }

    @Transactional(readOnly = true)
    public String findUserIdForEndpoint(String endpoint) {
        if (!isValidEndpoint(endpoint)) return null;
        return subscriptionRepository.findUserIdByEndpoint(endpoint).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<WebPushSubscription> findAllByUserId(String userId) {
        return subscriptionRepository.findAllByUserId(userId);
    }

    @Transactional
    public void remove(WebPushSubscription subscription) {
        subscriptionRepository.delete(subscription);
    }

    private boolean isKnownHttpsPushEndpoint(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme())
                    && host != null
                    && uri.getUserInfo() == null
                    && uri.getFragment() == null
                    && isKnownPushService(host.toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private boolean isKnownPushService(String host) {
        return PUSH_SERVICE_HOSTS.stream().anyMatch(service -> host.equals(service) || host.endsWith("." + service));
    }

    private boolean hasDecodedLength(String value, int expectedLength) {
        if (value == null || value.isBlank() || value.length() > 128) return false;
        try {
            return Base64.getUrlDecoder().decode(value).length == expectedLength;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
