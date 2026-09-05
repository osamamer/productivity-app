package org.osama.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.stat.SystemStatProvisioningService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final KeycloakAccountService keycloakAccountService;
    private final SystemStatProvisioningService systemStatProvisioningService;

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
        systemStatProvisioningService.createMissingSystemStatsFor(user);
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
        List<String> changedFields = new ArrayList<>();

        if (email != null && !email.equals(user.getEmail())) {
            if (userRepository.findUserByEmail(email).isPresent()) {
                throw new IllegalArgumentException("Email already taken: " + email);
            }
            user.setEmail(email);
            changedFields.add("email");
        }

        if (username != null && !username.equals(user.getUsername())) {
            if (userRepository.findUserByUsername(username).isPresent()) {
                throw new IllegalArgumentException("Username already taken: " + username);
            }
            user.setUsername(username);
            changedFields.add("username");
        }

        if (firstName != null) {
            if (!Objects.equals(firstName, user.getFirstName())) {
                changedFields.add("firstName");
            }
            user.setFirstName(firstName);
        }
        if (lastName != null) {
            if (!Objects.equals(lastName, user.getLastName())) {
                changedFields.add("lastName");
            }
            user.setLastName(lastName);
        }

        User savedUser = userRepository.save(user);
        log.info("User profile updated: userId={} changedFields={}", userId, changedFields);
        return savedUser;
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero) {
        return updatePreferences(userId, includeUnloggedNumericDaysAsZero, null,
                null, null, null, null);
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero,
                                  Boolean autoStartPomodoroSessions) {
        return updatePreferences(userId, includeUnloggedNumericDaysAsZero, autoStartPomodoroSessions,
                null, null, null, null);
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero,
                                  Boolean autoStartPomodoroSessions, Boolean checkupNotificationsEnabled,
                                  Integer checkupIntervalMinutes, LocalTime checkupStartTime,
                                  Integer checkupTimesPerDay) {
        if (includeUnloggedNumericDaysAsZero == null && autoStartPomodoroSessions == null
                && checkupNotificationsEnabled == null && checkupIntervalMinutes == null
                && checkupStartTime == null && checkupTimesPerDay == null) {
            throw new IllegalArgumentException("At least one user preference is required.");
        }

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        boolean numericPreferenceChanged = includeUnloggedNumericDaysAsZero != null
                && !Objects.equals(user.getIncludeUnloggedNumericDaysAsZero(), includeUnloggedNumericDaysAsZero);
        boolean pomodoroPreferenceChanged = autoStartPomodoroSessions != null
                && !Objects.equals(user.getAutoStartPomodoroSessions(), autoStartPomodoroSessions);
        boolean checkupPreferenceChanged = checkupNotificationsEnabled != null
                && !Objects.equals(user.getCheckupNotificationsEnabled(), checkupNotificationsEnabled);
        boolean checkupScheduleChanged = checkupIntervalMinutes != null
                || checkupStartTime != null
                || checkupTimesPerDay != null;

        int effectiveIntervalMinutes = checkupIntervalMinutes != null
                ? checkupIntervalMinutes : user.getCheckupIntervalMinutes();
        LocalTime effectiveStartTime = checkupStartTime != null
                ? checkupStartTime : user.getCheckupStartTime();
        int effectiveTimesPerDay = checkupTimesPerDay != null
                ? checkupTimesPerDay : user.getCheckupTimesPerDay();
        if (checkupScheduleChanged || checkupNotificationsEnabled != null) {
            validateCheckupSchedule(effectiveIntervalMinutes, effectiveStartTime, effectiveTimesPerDay);
        }

        if (includeUnloggedNumericDaysAsZero != null) {
            user.setIncludeUnloggedNumericDaysAsZero(includeUnloggedNumericDaysAsZero);
        }
        if (autoStartPomodoroSessions != null) {
            user.setAutoStartPomodoroSessions(autoStartPomodoroSessions);
        }
        if (checkupNotificationsEnabled != null) {
            user.setCheckupNotificationsEnabled(checkupNotificationsEnabled);
        }
        if (checkupIntervalMinutes != null) {
            user.setCheckupIntervalMinutes(checkupIntervalMinutes);
        }
        if (checkupStartTime != null) {
            user.setCheckupStartTime(checkupStartTime);
        }
        if (checkupTimesPerDay != null) {
            user.setCheckupTimesPerDay(checkupTimesPerDay);
        }
        User savedUser = userRepository.save(user);
        log.info("User preferences updated: userId={} includeUnloggedNumericDaysAsZero={} autoStartPomodoroSessions={} "
                        + "checkupNotificationsEnabled={} checkupIntervalMinutes={} checkupStartTime={} checkupTimesPerDay={} changed={}",
                userId, savedUser.getIncludeUnloggedNumericDaysAsZero(), savedUser.getAutoStartPomodoroSessions(),
                savedUser.getCheckupNotificationsEnabled(), savedUser.getCheckupIntervalMinutes(),
                savedUser.getCheckupStartTime(), savedUser.getCheckupTimesPerDay(),
                numericPreferenceChanged || pomodoroPreferenceChanged || checkupPreferenceChanged || checkupScheduleChanged);
        return savedUser;
    }

    private void validateCheckupSchedule(int intervalMinutes, LocalTime startTime, int timesPerDay) {
        if (intervalMinutes < 15 || intervalMinutes > 720) {
            throw new IllegalArgumentException("Check-up interval must be between 15 minutes and 12 hours.");
        }
        if (startTime == null) {
            throw new IllegalArgumentException("Check-up start time is required.");
        }
        if (timesPerDay < 1 || timesPerDay > 24) {
            throw new IllegalArgumentException("Check-ups per day must be between 1 and 24.");
        }
        long finalCheckupMinute = startTime.toSecondOfDay() / 60L
                + (long) (timesPerDay - 1) * intervalMinutes;
        if (finalCheckupMinute > 23 * 60 + 59) {
            throw new IllegalArgumentException("The check-up schedule must fit within the same day.");
        }
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
