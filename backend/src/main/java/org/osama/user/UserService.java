package org.osama.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final KeycloakAccountService keycloakAccountService;

    /**
     * Looks up the app User by Keycloak subject, creating one on first login.
     * Thread-safety: relies on the unique constraint on keycloakId — concurrent
     * first-logins for the same Keycloak user will fail with a constraint error on
     * the losing thread (acceptable; the user retries).
     */
    @Transactional
    public User getOrCreateFromJwt(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        return userRepository.findUserByKeycloakId(keycloakId)
                .orElseGet(() -> {
                    String email = jwt.getClaimAsString("email");
                    String firstName = jwt.getClaimAsString("given_name");
                    String lastName = jwt.getClaimAsString("family_name");
                    String username = jwt.getClaimAsString("preferred_username");

                    if (email == null || email.isBlank()) email = keycloakId + "@users.local";
                    if (firstName == null || firstName.isBlank()) firstName = username != null ? username : keycloakId;
                    if (lastName == null || lastName.isBlank()) lastName = "-";
                    if (username == null || username.isBlank()) username = email.split("@")[0];

                    log.info("Auto-provisioning user from Keycloak sub={}", keycloakId);
                    return createUser(email, firstName, lastName, username, keycloakId);
                });
    }

    @Transactional
    public User createUser(String email, String firstName, String lastName, String username, String keycloakId) {
        // Check if user already exists
        if (userRepository.findUserByEmail(email).isPresent()) {
            throw new IllegalArgumentException("User with email " + email + " already exists");
        }
        if (userRepository.findUserByUsername(username).isPresent()) {
            throw new IllegalArgumentException("User with username " + username + " already exists");
        }

        User user = User.builder()
                .id(UUID.randomUUID().toString())
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .username(username)
                .keycloakId(keycloakId)
                .active(true)
                .build();

        user = userRepository.save(user);
        log.info("Created user: {} with id: {}", username, user.getId());
        return user;
    }

    @Transactional(readOnly = true)
    public Optional<User> getUserById(String userId) {
        return userRepository.findUserById(userId);
    }

    @Transactional(readOnly = true)
    public Optional<User> getUserByEmail(String email) {
        return userRepository.findUserByEmail(email);
    }

    @Transactional(readOnly = true)
    public Optional<User> getUserByUsername(String username) {
        return userRepository.findUserByUsername(username);
    }

    @Transactional(readOnly = true)
    public Optional<User> getUserByKeycloakId(String keycloakId) {
        return userRepository.findUserByKeycloakId(keycloakId);
    }

    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User updateUser(String userId, String email, String firstName, String lastName, String username) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        if (email != null && !email.equals(user.getEmail())) {
            if (userRepository.findUserByEmail(email).isPresent()) {
                throw new IllegalArgumentException("Email already taken: " + email);
            }
            user.setEmail(email);
        }

        if (username != null && !username.equals(user.getUsername())) {
            if (userRepository.findUserByUsername(username).isPresent()) {
                throw new IllegalArgumentException("Username already taken: " + username);
            }
            user.setUsername(username);
        }

        if (firstName != null) user.setFirstName(firstName);
        if (lastName != null) user.setLastName(lastName);

        return userRepository.save(user);
    }

    @Transactional
    public void deactivateUser(String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        user.setActive(false);
        userRepository.save(user);
        log.info("Deactivated user: {}", userId);
    }

    @Transactional
    public void activateUser(String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        user.setActive(true);
        userRepository.save(user);
        log.info("Activated user: {}", userId);
    }

    @Transactional
    public void deleteUser(String userId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("User not found: " + userId);
        }
        userRepository.deleteById(userId);
        log.info("Deleted user: {}", userId);
    }

    public void changePassword(String username, String keycloakUserId, String currentPassword, String newPassword) {
        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required.");
        }
        if (newPassword == null || newPassword.isBlank()) {
            throw new IllegalArgumentException("New password is required.");
        }
        if (currentPassword.equals(newPassword)) {
            throw new IllegalArgumentException("New password must be different from the current password.");
        }

        keycloakAccountService.changePassword(username, keycloakUserId, currentPassword, newPassword);
        log.info("Changed password for Keycloak user {}", keycloakUserId);
    }
}
