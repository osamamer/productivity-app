package org.osama.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CurrentUserService {

    private final UserService userService;

    public User getCurrentUser() {
        Jwt jwt = (Jwt) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        try {
            return userService.getOrCreateFromJwt(jwt);
        } catch (DataIntegrityViolationException e) {
            // Two requests raced to create the user on first login; the loser retries the find.
            log.warn("Concurrent user creation detected for keycloakId={}, retrying lookup: {}", jwt.getSubject(), e.getMessage());
            return userService.getUserByKeycloakId(jwt.getSubject())
                    .orElseThrow(() -> e);
        }
    }

    public String getCurrentUserId() {
        return getCurrentUser().getId();
    }
}
