package org.osama.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.osama.pomodoro.PomodoroSoundIds;
import org.osama.pomodoro.PomodoroSoundRepository;
import org.osama.reminder.NotificationService;
import org.osama.stat.SystemStatProvisioningService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.oauth2.jwt.Jwt;

import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {
    private static final List<String> USER_OWNED_TABLES = List.of(
            "day_entity", "day_template", "pomodoro", "pomodoro_sound", "project", "reminder",
            "scheduled_job", "meditation_session", "stat_definition", "stat_entry", "note",
            "note_category", "task", "task_series", "task_group", "stat_group", "mental_thread",
            "mental_capacity_check_in", "mental_state_check_in", "calendar_event", "mobile_push_token");

    private final UserRepository userRepository;
    private final KeycloakAccountService keycloakAccountService;
    private final SystemStatProvisioningService systemStatProvisioningService;
    private final NotificationService notificationService;
    private final PomodoroSoundRepository pomodoroSoundRepository;
    @PersistenceContext
    private EntityManager entityManager;

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
                null, null, null, null, null, null);
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero,
                                  Boolean autoStartPomodoroSessions) {
        return updatePreferences(userId, includeUnloggedNumericDaysAsZero, autoStartPomodoroSessions,
                null, null, null, null, null, null);
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero,
                                  Boolean autoStartPomodoroSessions, Boolean checkupNotificationsEnabled,
                                  Integer checkupIntervalMinutes, LocalTime checkupStartTime,
                                  Integer checkupTimesPerDay) {
        return updatePreferences(userId, includeUnloggedNumericDaysAsZero, autoStartPomodoroSessions,
                checkupNotificationsEnabled, null, checkupIntervalMinutes, checkupStartTime, checkupTimesPerDay, null);
    }

    @Transactional
    public User updatePreferences(String userId, Boolean includeUnloggedNumericDaysAsZero,
                                  Boolean autoStartPomodoroSessions, Boolean checkupNotificationsEnabled,
                                  Boolean repeatCheckupNotificationsEnabled, Integer checkupIntervalMinutes,
                                  LocalTime checkupStartTime, Integer checkupTimesPerDay,
                                  String pomodoroSoundId) {
        return updatePreferences(userId, new UserPreferenceUpdates(
                includeUnloggedNumericDaysAsZero, autoStartPomodoroSessions,
                checkupNotificationsEnabled, repeatCheckupNotificationsEnabled,
                checkupIntervalMinutes, checkupStartTime, checkupTimesPerDay, null, pomodoroSoundId,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));
    }

    @Transactional
    public User updatePreferences(String userId, UserPreferenceUpdates updates) {
        if (updates == null || updates.isEmpty()) {
            throw new IllegalArgumentException("At least one user preference is required.");
        }

        User user = userRepository.findUserByIdForUpdate(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        boolean checkupScheduleChanged = updates.checkupIntervalMinutes() != null
                || updates.checkupStartTime() != null
                || updates.checkupTimesPerDay() != null
                || updates.checkupTimeZone() != null;

        int effectiveIntervalMinutes = updates.checkupIntervalMinutes() != null
                ? updates.checkupIntervalMinutes() : user.getCheckupIntervalMinutes();
        LocalTime effectiveStartTime = updates.checkupStartTime() != null
                ? updates.checkupStartTime() : user.getCheckupStartTime();
        int effectiveTimesPerDay = updates.checkupTimesPerDay() != null
                ? updates.checkupTimesPerDay() : user.getCheckupTimesPerDay();
        if (checkupScheduleChanged || updates.checkupNotificationsEnabled() != null) {
            validateCheckupSchedule(effectiveIntervalMinutes, effectiveStartTime, effectiveTimesPerDay);
        }
        if (updates.checkupTimeZone() != null) validateCheckupTimeZone(updates.checkupTimeZone());
        validateUserSettings(updates);

        if (updates.includeUnloggedNumericDaysAsZero() != null) user.setIncludeUnloggedNumericDaysAsZero(updates.includeUnloggedNumericDaysAsZero());
        if (updates.autoStartPomodoroSessions() != null) user.setAutoStartPomodoroSessions(updates.autoStartPomodoroSessions());
        if (updates.pomodoroSoundId() != null) {
            validatePomodoroSoundSelection(updates.pomodoroSoundId(), userId);
            user.setPomodoroSoundId(updates.pomodoroSoundId());
        }
        if (updates.checkupNotificationsEnabled() != null) user.setCheckupNotificationsEnabled(updates.checkupNotificationsEnabled());
        if (updates.repeatCheckupNotificationsEnabled() != null) user.setRepeatCheckupNotificationsEnabled(updates.repeatCheckupNotificationsEnabled());
        if (updates.checkupIntervalMinutes() != null) user.setCheckupIntervalMinutes(updates.checkupIntervalMinutes());
        if (updates.checkupStartTime() != null) user.setCheckupStartTime(updates.checkupStartTime());
        if (updates.checkupTimesPerDay() != null) user.setCheckupTimesPerDay(updates.checkupTimesPerDay());
        if (updates.checkupTimeZone() != null) user.setCheckupTimeZone(updates.checkupTimeZone());
        if (updates.showCompletedHomeTasks() != null) user.setShowCompletedHomeTasks(updates.showCompletedHomeTasks());
        if (updates.excludeTodayCompletedTasks() != null) user.setExcludeTodayCompletedTasks(updates.excludeTodayCompletedTasks());
        if (updates.showClosedMentalThreads() != null) user.setShowClosedMentalThreads(updates.showClosedMentalThreads());
        if (updates.soundEffectsEnabled() != null) user.setSoundEffectsEnabled(updates.soundEffectsEnabled());
        if (updates.whiteNoiseEnabled() != null) user.setWhiteNoiseEnabled(updates.whiteNoiseEnabled());
        if (updates.pomodoroSecondsMode() != null) user.setPomodoroSecondsMode(updates.pomodoroSecondsMode());
        if (updates.pomodoroLongBreakCooldown() != null) user.setPomodoroLongBreakCooldown(updates.pomodoroLongBreakCooldown());
        if (updates.pomodoroFocusDuration() != null) user.setPomodoroFocusDuration(updates.pomodoroFocusDuration());
        if (updates.pomodoroShortBreakDuration() != null) user.setPomodoroShortBreakDuration(updates.pomodoroShortBreakDuration());
        if (updates.pomodoroLongBreakDuration() != null) user.setPomodoroLongBreakDuration(updates.pomodoroLongBreakDuration());
        if (updates.pomodoroNumFocuses() != null) user.setPomodoroNumFocuses(updates.pomodoroNumFocuses());
        if (updates.themeMode() != null) user.setThemeMode(updates.themeMode());
        if (updates.accentColor() != null) user.setAccentColor(updates.accentColor());
        if (updates.meditationDurationMinutes() != null) user.setMeditationDurationMinutes(updates.meditationDurationMinutes());
        if (updates.meditationIntervalBells() != null) user.setMeditationIntervalBells(updates.meditationIntervalBells());
        if (updates.meditationSound() != null) user.setMeditationSound(updates.meditationSound());

        User savedUser = userRepository.save(user);
        log.info("User preferences updated: userId={} changedFields={}", userId, updates);
        if (checkupScheduleChanged || Boolean.FALSE.equals(savedUser.getCheckupNotificationsEnabled())
                || Boolean.FALSE.equals(savedUser.getRepeatCheckupNotificationsEnabled())) {
            notificationService.clearPendingCheckupNotifications(userId);
        }
        return savedUser;
    }

    private void validateUserSettings(UserPreferenceUpdates updates) {
        if (updates.pomodoroLongBreakCooldown() != null
                && (updates.pomodoroLongBreakCooldown() < 1 || updates.pomodoroLongBreakCooldown() > 5)) {
            throw new IllegalArgumentException("Long break frequency must be between 1 and 5 sessions.");
        }
        if (updates.pomodoroFocusDuration() != null && updates.pomodoroFocusDuration() < 1) {
            throw new IllegalArgumentException("Focus duration must be positive.");
        }
        if (updates.pomodoroShortBreakDuration() != null && updates.pomodoroShortBreakDuration() < 1) {
            throw new IllegalArgumentException("Short break duration must be positive.");
        }
        if (updates.pomodoroLongBreakDuration() != null && updates.pomodoroLongBreakDuration() < 1) {
            throw new IllegalArgumentException("Long break duration must be positive.");
        }
        if (updates.pomodoroNumFocuses() != null && updates.pomodoroNumFocuses() < 1) {
            throw new IllegalArgumentException("The number of focus sessions must be positive.");
        }
        if (updates.themeMode() != null
                && !updates.themeMode().equals("light") && !updates.themeMode().equals("dark")) {
            throw new IllegalArgumentException("Theme mode must be light or dark.");
        }
        if (updates.accentColor() != null
                && !List.of("teal", "coral", "amber", "violet").contains(updates.accentColor())) {
            throw new IllegalArgumentException("That accent color is not available.");
        }
        if (updates.meditationDurationMinutes() != null
                && !List.of(5, 10, 15, 20, 30).contains(updates.meditationDurationMinutes())) {
            throw new IllegalArgumentException("That meditation duration is not available.");
        }
        if (updates.meditationIntervalBells() != null
                && (updates.meditationIntervalBells() < 0 || updates.meditationIntervalBells() > 10)) {
            throw new IllegalArgumentException("Interval bells must be between 0 and 10.");
        }
        if (updates.meditationSound() != null
                && !List.of("rain", "ocean", "forest", "bowls").contains(updates.meditationSound())) {
            throw new IllegalArgumentException("That meditation sound is not available.");
        }
    }

    private void validatePomodoroSoundSelection(String pomodoroSoundId, String userId) {
        if (PomodoroSoundIds.BROWN_NOISE.equals(pomodoroSoundId)) return;
        if (!pomodoroSoundRepository.existsByIdAndUserId(pomodoroSoundId, userId)) {
            throw new IllegalArgumentException("That Pomodoro sound is not available.");
        }
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
        if (finalCheckupMinute > 24 * 60) {
            throw new IllegalArgumentException("The check-up schedule must fit within the same day or end at midnight.");
        }
    }

    private void validateCheckupTimeZone(String timeZone) {
        try {
            ZoneId.of(timeZone);
        } catch (DateTimeException | NullPointerException e) {
            throw new IllegalArgumentException("Check-up time zone must be a valid IANA time zone.", e);
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
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        softDeleteUserData(userId);
        userRepository.delete(user);
        log.info("Deleted user: {}", userId);
    }

    private void softDeleteUserData(String userId) {
        entityManager.flush();
        softDeleteRelatedRows("UPDATE day_template_event SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND template_id IN (SELECT template_id FROM day_template WHERE user_id = :userId)", userId);
        softDeleteRelatedRows("UPDATE day_template_task SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND template_id IN (SELECT template_id FROM day_template WHERE user_id = :userId)", userId);
        softDeleteRelatedRows("UPDATE calendar_event_cancellation SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND event_id IN (SELECT event_id FROM calendar_event WHERE user_id = :userId)", userId);
        softDeleteRelatedRows("UPDATE mental_thread_load_entry SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND thread_id IN (SELECT thread_id FROM mental_thread WHERE user_id = :userId)", userId);
        softDeleteRelatedRows("UPDATE stat_focus_task_link SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND stat_definition_id IN (SELECT id FROM stat_definition WHERE user_id = :userId)", userId);
        softDeleteRelatedRows("UPDATE stat_group_definition SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND (group_id IN (SELECT group_id FROM stat_group WHERE user_id = :userId) "
                + "OR stat_definition_id IN (SELECT id FROM stat_definition WHERE user_id = :userId))", userId);
        softDeleteRelatedRows("UPDATE task_group_task SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND (group_id IN (SELECT group_id FROM task_group WHERE user_id = :userId) "
                + "OR task_id IN (SELECT task_id FROM task WHERE user_id = :userId))", userId);
        softDeleteRelatedRows("UPDATE task_session SET soft_deleted = TRUE WHERE soft_deleted = FALSE "
                + "AND associated_task_id IN (SELECT task_id FROM task WHERE user_id = :userId)", userId);
        USER_OWNED_TABLES.forEach(table -> softDeleteUserOwnedRows(table, userId));
        // Native bulk updates do not refresh entities already loaded in this persistence context.
        entityManager.clear();
    }

    private void softDeleteRelatedRows(String sql, String userId) {
        entityManager.createNativeQuery(sql)
                .setParameter("userId", userId)
                .executeUpdate();
    }

    private void softDeleteUserOwnedRows(String table, String userId) {
        entityManager.createNativeQuery("UPDATE " + table
                        + " SET soft_deleted = TRUE WHERE user_id = :userId AND soft_deleted = FALSE")
                .setParameter("userId", userId)
                .executeUpdate();
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
