package org.osama.calendar;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@Slf4j
public class CalendarService {
    private static final Set<String> PALETTE = Set.of(
            "accent", "blue", "purple", "green", "orange", "red", "teal", "pink", "indigo"
    );

    private final CalendarRepository calendarRepository;
    private final UserRepository userRepository;

    public CalendarService(CalendarRepository calendarRepository, UserRepository userRepository) {
        this.calendarRepository = calendarRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public List<CalendarResponse> getCalendars(String userId) {
        ensureDefaultCalendar(userId);
        return calendarRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CalendarResponse createCalendar(CreateCalendarRequest request, String userId) {
        if (request == null) throw new IllegalArgumentException("Calendar details are required.");
        User user = findUser(userId);
        String name = normalizeName(request.name());
        String color = normalizeColor(request.color());
        UserCalendar calendar = new UserCalendar();
        calendar.initializeId();
        calendar.setUser(user);
        calendar.setName(name);
        calendar.setColor(color);
        calendar.setDisplayOrder(calendarRepository.findFirstByUserIdOrderByDisplayOrderDesc(userId)
                .map(existing -> existing.getDisplayOrder() + 1).orElse(1));
        calendar.setDefaultCalendar(false);
        calendar.setVisible(true);
        UserCalendar saved = calendarRepository.save(calendar);
        log.info("Calendar created: userId={} calendarId={} displayOrder={}",
                userId, saved.getId(), saved.getDisplayOrder());
        return toResponse(saved);
    }

    @Transactional
    public CalendarResponse updateCalendar(String calendarId, UpdateCalendarRequest request, String userId) {
        if (request == null || request.isEmpty()) {
            throw new IllegalArgumentException("At least one calendar setting is required.");
        }
        UserCalendar calendar = findOwnedCalendar(calendarId, userId);
        if (request.name() != null) calendar.setName(normalizeName(request.name()));
        if (request.color() != null) calendar.setColor(normalizeColor(request.color()));
        if (request.displayOrder() != null) {
            if (request.displayOrder() < 0) throw new IllegalArgumentException("Calendar order cannot be negative.");
            calendar.setDisplayOrder(request.displayOrder());
        }
        if (request.visible() != null) calendar.setVisible(request.visible());
        UserCalendar saved = calendarRepository.save(calendar);
        log.info("Calendar updated: userId={} calendarId={} visible={} displayOrder={}",
                userId, saved.getId(), saved.isVisible(), saved.getDisplayOrder());
        return toResponse(saved);
    }

    @Transactional
    public void deleteCalendar(String calendarId, String userId) {
        UserCalendar calendar = findOwnedCalendar(calendarId, userId);
        if (calendar.isDefaultCalendar()) {
            throw new IllegalArgumentException("The default calendar cannot be deleted.");
        }
        calendarRepository.delete(calendar);
        log.info("Calendar soft-deleted: userId={} calendarId={}", userId, calendarId);
    }

    @Transactional
    public String defaultCalendarId(String userId) {
        return ensureDefaultCalendar(userId).getId();
    }

    @Transactional
    public String resolveCalendarId(String requestedCalendarId, String userId) {
        if (requestedCalendarId == null || requestedCalendarId.isBlank()) {
            return defaultCalendarId(userId);
        }
        return findOwnedCalendar(requestedCalendarId.trim(), userId).getId();
    }

    @Transactional
    public String resolveTemplateCalendarId(String requestedCalendarId, String userId) {
        if (requestedCalendarId == null || requestedCalendarId.isBlank()) return defaultCalendarId(userId);
        return calendarRepository.findByIdAndUserId(requestedCalendarId.trim(), userId)
                .map(UserCalendar::getId)
                .orElseGet(() -> defaultCalendarId(userId));
    }

    @Transactional
    public String resolveStoredTemplateCalendarId(String requestedCalendarId, String userId) {
        if (requestedCalendarId == null || requestedCalendarId.isBlank()) return defaultCalendarId(userId);
        return calendarRepository.findCalendarIdIncludingDeleted(requestedCalendarId.trim(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar not found: " + requestedCalendarId));
    }

    @Transactional(readOnly = true)
    public boolean isActiveOwnedCalendar(String calendarId, String userId) {
        return calendarId != null && calendarRepository.findByIdAndUserId(calendarId, userId).isPresent();
    }

    private UserCalendar ensureDefaultCalendar(String userId) {
        return calendarRepository.findByUserIdAndDefaultCalendarTrue(userId)
                .orElseGet(() -> createDefaultCalendar(findUser(userId)));
    }

    private UserCalendar createDefaultCalendar(User user) {
        UserCalendar calendar = new UserCalendar();
        calendar.setId("default-" + user.getId());
        calendar.setUser(user);
        calendar.setName("Default");
        calendar.setColor("accent");
        calendar.setDisplayOrder(0);
        calendar.setDefaultCalendar(true);
        calendar.setVisible(true);
        UserCalendar saved = calendarRepository.save(calendar);
        log.info("Default calendar provisioned: userId={} calendarId={}", user.getId(), saved.getId());
        return saved;
    }

    private UserCalendar findOwnedCalendar(String calendarId, String userId) {
        return calendarRepository.findByIdAndUserId(calendarId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Calendar not found: " + calendarId));
    }

    private User findUser(String userId) {
        return userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private String normalizeName(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isBlank() || name.length() > 120) {
            throw new IllegalArgumentException("Calendar name must contain between 1 and 120 characters.");
        }
        return name;
    }

    private String normalizeColor(String value) {
        String color = value == null ? "" : value.trim().toLowerCase();
        if (!PALETTE.contains(color)) throw new IllegalArgumentException("Choose a color from the calendar palette.");
        return color;
    }

    private CalendarResponse toResponse(UserCalendar calendar) {
        return new CalendarResponse(calendar.getId(), calendar.getName(), calendar.getColor(),
                calendar.getDisplayOrder(), calendar.isDefaultCalendar(), calendar.isVisible());
    }
}
