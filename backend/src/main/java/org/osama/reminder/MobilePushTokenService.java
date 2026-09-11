package org.osama.reminder;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MobilePushTokenService {
    private static final int MAX_TOKEN_LENGTH = 512;

    private final MobilePushTokenRepository tokenRepository;

    public boolean isValid(String token) {
        return token != null && !token.isBlank() && token.length() <= MAX_TOKEN_LENGTH
                && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
    }

    @Transactional
    public void register(User user, String token) {
        validate(token);
        MobilePushToken pushToken = tokenRepository.findById(token).orElseGet(MobilePushToken::new);
        pushToken.setToken(token);
        pushToken.setUser(user);
        tokenRepository.save(pushToken);
        log.info("Mobile push token registered: userId={}", user.getId());
    }

    @Transactional
    public void removeForUser(String userId) {
        long removed = tokenRepository.deleteByUserId(userId);
        if (removed > 0) {
            log.info("Mobile push tokens removed: userId={} count={}", userId, removed);
        }
    }

    private void validate(String token) {
        if (!isValid(token)) {
            throw new IllegalArgumentException("Invalid mobile push token");
        }
    }
}
