package org.osama.daytemplate;

import lombok.extern.slf4j.Slf4j;
import org.osama.day.DayService;
import org.osama.event.CalendarEventRequest;
import org.osama.event.CalendarEventResponse;
import org.osama.event.CalendarEventService;
import org.osama.event.CalendarEventStatus;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.requests.NewTaskRequest;
import org.osama.task.Task;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class DayTemplateService {
    private static final int MAX_REMINDER_MINUTES = 8 * 7 * 24 * 60;

    private final DayTemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final DayService dayService;
    private final CalendarEventService calendarEventService;
    private final TaskService taskService;

    public DayTemplateService(DayTemplateRepository templateRepository,
                              UserRepository userRepository,
                              DayService dayService,
                              CalendarEventService calendarEventService,
                              TaskService taskService) {
        this.templateRepository = templateRepository;
        this.userRepository = userRepository;
        this.dayService = dayService;
        this.calendarEventService = calendarEventService;
        this.taskService = taskService;
    }

    @Transactional(readOnly = true)
    public List<DayTemplateResponse> getTemplates(String userId) {
        return templateRepository.findAllByUserIdOrderByNameAsc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DayTemplateResponse getTemplate(String templateId, String userId) {
        return toResponse(findTemplate(templateId, userId));
    }

    @Transactional
    public DayTemplateResponse createTemplate(DayTemplateRequest request, String userId) {
        User user = findUser(userId);
        ValidatedTemplateItems items = validateAndBuildItems(request);

        DayTemplate template = new DayTemplate();
        template.initializeId();
        template.setUser(user);
        template.setName(normalizeTemplateName(request.name()));
        template.replaceItems(items.events(), items.tasks());
        DayTemplate saved = templateRepository.save(template);
        log.info("Day template created: userId={} templateId={} eventCount={} taskCount={}",
                userId, saved.getId(), items.events().size(), items.tasks().size());
        return toResponse(saved);
    }

    @Transactional
    public DayTemplateResponse updateTemplate(String templateId, DayTemplateRequest request, String userId) {
        DayTemplate template = findTemplate(templateId, userId);
        ValidatedTemplateItems items = validateAndBuildItems(request);
        template.setName(normalizeTemplateName(request.name()));
        template.replaceItems(items.events(), items.tasks());
        DayTemplate saved = templateRepository.save(template);
        log.info("Day template updated: userId={} templateId={} eventCount={} taskCount={}",
                userId, saved.getId(), items.events().size(), items.tasks().size());
        return toResponse(saved);
    }

    @Transactional
    public void deleteTemplate(String templateId, String userId) {
        DayTemplate template = findTemplate(templateId, userId);
        templateRepository.delete(template);
        log.info("Day template deleted: userId={} templateId={}", userId, templateId);
    }

    @Transactional
    public DayTemplateApplicationResponse applyTemplate(String templateId, LocalDate date, String userId) {
        if (date == null) {
            throw new IllegalArgumentException("A target date is required.");
        }

        DayTemplate template = findTemplate(templateId, userId);
        dayService.getOrCreateDay(date, userId);
        dayService.markTemplateApplied(date, template.getId(), template.getName(), userId);

        List<CalendarEventResponse> events = new ArrayList<>();
        for (DayTemplateEvent templateEvent : template.getEvents()) {
            events.add(calendarEventService.createEvent(toEventRequest(templateEvent, date), userId));
        }

        List<Task> tasks = new ArrayList<>(template.getTasks().size());
        for (int index = template.getTasks().size() - 1; index >= 0; index--) {
            DayTemplateTask templateTask = template.getTasks().get(index);
            tasks.add(0, taskService.createTask(toTaskRequest(templateTask, date), userId));
        }

        log.info("Day template applied: userId={} templateId={} date={} eventCount={} taskCount={}",
                userId, templateId, date, events.size(), tasks.size());
        return new DayTemplateApplicationResponse(template.getId(), template.getName(), date, events, tasks);
    }

    private DayTemplate findTemplate(String templateId, String userId) {
        return templateRepository.findByIdAndUserId(templateId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Day template not found: " + templateId));
    }

    private User findUser(String userId) {
        return userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
    }

    private ValidatedTemplateItems validateAndBuildItems(DayTemplateRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Template details are required.");
        }
        String name = normalizeTemplateName(request.name());
        if (name.isEmpty() || name.length() > 120) {
            throw new IllegalArgumentException("Template name must contain between 1 and 120 characters.");
        }

        List<DayTemplateEvent> events = new ArrayList<>();
        List<DayTemplateEventRequest> eventRequests = request.events() == null ? List.of() : request.events();
        for (int index = 0; index < eventRequests.size(); index++) {
            events.add(toEventEntity(eventRequests.get(index), index));
        }

        List<DayTemplateTask> tasks = new ArrayList<>();
        List<DayTemplateTaskRequest> taskRequests = request.tasks() == null ? List.of() : request.tasks();
        for (int index = 0; index < taskRequests.size(); index++) {
            tasks.add(toTaskEntity(taskRequests.get(index), index));
        }
        if (events.isEmpty() && tasks.isEmpty()) {
            throw new IllegalArgumentException("A day template must contain at least one event or task.");
        }
        return new ValidatedTemplateItems(events, tasks);
    }

    private DayTemplateEvent toEventEntity(DayTemplateEventRequest request, int displayOrder) {
        if (request == null) {
            throw new IllegalArgumentException("Template events cannot be null.");
        }
        String title = normalize(request.title());
        if (title.isEmpty() || title.length() > 200) {
            throw new IllegalArgumentException("Template event title must contain between 1 and 200 characters.");
        }
        String timeZone = normalize(request.timeZone());
        if (timeZone.isEmpty()) {
            timeZone = "UTC";
        }
        validateTimeZone(timeZone);
        if (request.reminderMinutesBefore() != null
                && (request.reminderMinutesBefore() < 0 || request.reminderMinutesBefore() > MAX_REMINDER_MINUTES)) {
            throw new IllegalArgumentException("Reminder must be between the event start and eight weeks before it.");
        }
        if (request.allDay() && (request.startTime() != null || request.endTime() != null)) {
            throw new IllegalArgumentException("An all-day template event cannot have a time of day.");
        }
        if (!request.allDay() && (request.startTime() == null || request.endTime() == null
                || !request.endTime().isAfter(request.startTime()))) {
            throw new IllegalArgumentException("A timed template event needs a finish time after its start time.");
        }

        DayTemplateEvent event = new DayTemplateEvent();
        event.initializeId();
        event.setDisplayOrder(displayOrder);
        event.setTitle(title);
        event.setDescription(normalize(request.description()));
        event.setAllDay(request.allDay());
        event.setStartTime(request.allDay() ? null : request.startTime());
        event.setEndTime(request.allDay() ? null : request.endTime());
        event.setTimeZone(timeZone);
        event.setReminderMinutesBefore(request.reminderMinutesBefore());
        event.setStatus(request.status() == null ? CalendarEventStatus.CONFIRMED : request.status());
        return event;
    }

    private DayTemplateTask toTaskEntity(DayTemplateTaskRequest request, int displayOrder) {
        if (request == null) {
            throw new IllegalArgumentException("Template tasks cannot be null.");
        }
        String name = normalize(request.name());
        if (name.isEmpty() || name.length() > 255) {
            throw new IllegalArgumentException("Template task name must contain between 1 and 255 characters.");
        }
        if (request.importance() < 0 || request.importance() > 10) {
            throw new IllegalArgumentException("Template task importance must be between 0 and 10.");
        }
        String tag = normalize(request.tag());
        if (tag.length() > 50) {
            throw new IllegalArgumentException("Template task tag must not exceed 50 characters.");
        }

        DayTemplateTask task = new DayTemplateTask();
        task.initializeId();
        task.setDisplayOrder(displayOrder);
        task.setName(name);
        task.setDescription(normalize(request.description()));
        task.setScheduledTime(request.scheduledTime());
        task.setTag(tag.isEmpty() ? null : tag);
        task.setImportance(request.importance());
        return task;
    }

    private CalendarEventRequest toEventRequest(DayTemplateEvent templateEvent, LocalDate date) {
        CalendarEventRequest request = new CalendarEventRequest();
        request.setTitle(templateEvent.getTitle());
        request.setDescription(templateEvent.getDescription());
        request.setAllDay(templateEvent.isAllDay());
        request.setTimeZone(templateEvent.getTimeZone());
        request.setReminderMinutesBefore(templateEvent.getReminderMinutesBefore());
        request.setStatus(templateEvent.getStatus());
        if (templateEvent.isAllDay()) {
            request.setStartDate(date);
            request.setEndDate(date);
        } else {
            ZoneId zone = ZoneId.of(templateEvent.getTimeZone());
            request.setStartTime(LocalDateTime.of(date, templateEvent.getStartTime()).atZone(zone).toInstant());
            request.setEndTime(LocalDateTime.of(date, templateEvent.getEndTime()).atZone(zone).toInstant());
        }
        return request;
    }

    private NewTaskRequest toTaskRequest(DayTemplateTask templateTask, LocalDate date) {
        NewTaskRequest request = new NewTaskRequest();
        request.setName(templateTask.getName());
        request.setDescription(templateTask.getDescription());
        request.setScheduledPerformDateTime(LocalDateTime.of(
                date, templateTask.getScheduledTime() == null ? java.time.LocalTime.MIDNIGHT : templateTask.getScheduledTime()
        ).toString());
        request.setTag(templateTask.getTag());
        request.setImportance(templateTask.getImportance());
        return request;
    }

    private DayTemplateResponse toResponse(DayTemplate template) {
        List<DayTemplateEventResponse> events = template.getEvents().stream()
                .map(event -> new DayTemplateEventResponse(event.getId(), event.getDisplayOrder(), event.getTitle(),
                        event.getDescription(), event.isAllDay(), event.getStartTime(), event.getEndTime(),
                        event.getTimeZone(), event.getReminderMinutesBefore(), event.getStatus()))
                .toList();
        List<DayTemplateTaskResponse> tasks = template.getTasks().stream()
                .map(task -> new DayTemplateTaskResponse(task.getId(), task.getDisplayOrder(), task.getName(),
                        task.getDescription(), task.getScheduledTime(), task.getTag(), task.getImportance()))
                .toList();
        return new DayTemplateResponse(template.getId(), template.getName(), events, tasks,
                template.getCreatedAt(), template.getUpdatedAt());
    }

    private void validateTimeZone(String timeZone) {
        try {
            ZoneId.of(timeZone);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("Template event time zone is invalid.", exception);
        }
    }

    private String normalizeTemplateName(String value) {
        return normalize(value);
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private record ValidatedTemplateItems(List<DayTemplateEvent> events, List<DayTemplateTask> tasks) {
    }
}
