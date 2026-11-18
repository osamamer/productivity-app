package org.osama.activity;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.event.CalendarEventRepository;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityService {
    public static final int MAX_NAME_LENGTH = 60;
    // Named colours, not hex, so the web app can pick shades that read in light and dark themes.
    static final Set<String> COLORS = Set.of("violet", "blue", "teal", "green", "amber", "orange", "rose", "slate");

    private final ActivityRepository activityRepository;
    private final CalendarEventRepository eventRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ActivityResponse> getActivities(String userId) {
        return activityRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).stream()
                .map(ActivityResponse::from)
                .toList();
    }

    @Transactional
    public ActivityResponse createActivity(ActivityRequest request, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        Activity activity = new Activity();
        activity.setId(UUID.randomUUID().toString());
        activity.setUser(user);
        activity.setName(validateName(request.name()));
        activity.setColor(validateColor(request.color() == null ? "violet" : request.color()));
        activity.setDisplayOrder(request.displayOrder() != null
                ? request.displayOrder()
                : activityRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).size());
        Activity saved = activityRepository.save(activity);
        log.info("Activity created: userId={} activityId={} color={}", userId, saved.getId(), saved.getColor());
        return ActivityResponse.from(saved);
    }

    @Transactional
    public ActivityResponse updateActivity(String activityId, ActivityRequest request, String userId) {
        Activity activity = findOwned(activityId, userId);
        if (request.name() != null) activity.setName(validateName(request.name()));
        if (request.color() != null) activity.setColor(validateColor(request.color()));
        if (request.displayOrder() != null) activity.setDisplayOrder(request.displayOrder());
        Activity saved = activityRepository.saveAndFlush(activity);
        log.info("Activity updated: userId={} activityId={}", userId, activityId);
        return ActivityResponse.from(saved);
    }

    /** Deletes the activity; chunks that used it stay on the calendar without one. */
    @Transactional
    public void deleteActivity(String activityId, String userId) {
        Activity activity = findOwned(activityId, userId);
        int cleared = eventRepository.clearActivity(activityId, userId);
        activityRepository.delete(activity);
        log.info("Activity deleted: userId={} activityId={} eventsCleared={}", userId, activityId, cleared);
    }

    /** The id itself when it names one of the user's activities, null when blank. */
    @Transactional(readOnly = true)
    public String resolveActivityId(String activityId, String userId) {
        if (activityId == null || activityId.isBlank()) return null;
        return findOwned(activityId, userId).getId();
    }

    private Activity findOwned(String activityId, String userId) {
        return activityRepository.findByIdAndUserId(activityId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Activity not found: " + activityId));
    }

    private static String validateName(String name) {
        String normalized = name == null ? "" : name.trim();
        if (normalized.isEmpty() || normalized.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Activity name must contain between 1 and 60 characters.");
        }
        return normalized;
    }

    private static String validateColor(String color) {
        String normalized = color.trim().toLowerCase(Locale.ROOT);
        if (!COLORS.contains(normalized)) {
            throw new IllegalArgumentException("Activity colour is invalid.");
        }
        return normalized;
    }
}
