package org.osama.desktop;

import org.osama.user.KeycloakAccountService;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * Replaces Keycloak account operations in local mode, where there is one implicit user and no
 * identity server. The operating-system account is the security boundary for local data, so
 * password confirmation (used to unlock secret stats) always succeeds. Account registration
 * and password changes do not exist locally.
 */
@Service
@Primary
@Profile("desktop")
public class DesktopAccountService extends KeycloakAccountService {

    @Override
    public void verifyCurrentPassword(String username, String currentPassword) {
        // Intentionally accepted: local mode has no account password to compare against.
    }

    @Override
    public void changePassword(String username, String keycloakUserId, String currentPassword, String newPassword) {
        throw new UnsupportedOperationException("Local mode has no account password");
    }

    @Override
    public void registerUser(String email, String firstName, String lastName, String username, String password) {
        throw new UnsupportedOperationException("Local mode does not create accounts");
    }
}
