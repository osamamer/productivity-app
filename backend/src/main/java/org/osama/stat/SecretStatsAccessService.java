package org.osama.stat;

import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.CurrentUserService;
import org.osama.user.KeycloakAccountService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Base64;

@Service
public class SecretStatsAccessService {

    private static final int ACCESS_MINUTES = 15;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretStatsAccessRepository accessRepository;
    private final StatDefinitionRepository definitionRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUserService;
    private final KeycloakAccountService keycloakAccountService;

    public SecretStatsAccessService(SecretStatsAccessRepository accessRepository,
                                    StatDefinitionRepository definitionRepository,
                                    UserRepository userRepository,
                                    CurrentUserService currentUserService,
                                    KeycloakAccountService keycloakAccountService) {
        this.accessRepository = accessRepository;
        this.definitionRepository = definitionRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
        this.keycloakAccountService = keycloakAccountService;
    }

    @Transactional
    public GrantResponse unlock(String password, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        String username = currentUserService.getCurrentJwt().getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) username = user.getUsername();
        keycloakAccountService.verifyCurrentPassword(username, password);

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        accessRepository.deleteExpired(now);
        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        LocalDateTime expiresAt = now.plusMinutes(ACCESS_MINUTES);
        accessRepository.save(new SecretStatsAccess(hash(token), user, expiresAt));
        return new GrantResponse(token, expiresAt.atOffset(ZoneOffset.UTC).toInstant().toString());
    }

    @Transactional(readOnly = true)
    public boolean hasAccess(String userId, String token) {
        if (token == null || token.isBlank()) return false;
        return accessRepository.existsValidAccess(hash(token), userId, LocalDateTime.now(ZoneOffset.UTC));
    }

    @Transactional
    public void lock(String userId, String token) {
        if (token != null && !token.isBlank()) {
            accessRepository.deleteAccess(hash(token), userId);
        }
    }

    @Transactional(readOnly = true)
    public void requireDefinitionAccess(String definitionId, String userId, String token) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat exists."));
        if (definition.isSecret() && !hasAccess(userId, token)) {
            throw new ResourceNotFoundException("No such stat exists.");
        }
    }

    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable.", e);
        }
    }

    public record GrantResponse(String accessToken, String expiresAt) { }
}
