package org.osama.reminder;

import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalTime;
import java.time.ZonedDateTime;

@Service
@Slf4j
public class MentalStateCheckupScheduler {
    private static final int DEFAULT_INTERVAL_MINUTES = 180;
    private static final LocalTime DEFAULT_START_TIME = LocalTime.of(9, 0);
    private static final int DEFAULT_TIMES_PER_DAY = 5;

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    @Autowired
    public MentalStateCheckupScheduler(UserRepository userRepository,
                                       NotificationService notificationService) {
        this(userRepository, notificationService, Clock.systemDefaultZone());
    }

    MentalStateCheckupScheduler(UserRepository userRepository,
                                NotificationService notificationService,
                                Clock clock) {
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.clock = clock;
    }

    @Scheduled(cron = "0 * * * * *")
    @Transactional
    public void createDueCheckups() {
        ZonedDateTime scheduledAt = ZonedDateTime.now(clock)
                .withSecond(0)
                .withNano(0);

        userRepository.findAllByActiveTrue().forEach(user -> {
            if (Boolean.FALSE.equals(user.getCheckupNotificationsEnabled())) {
                notificationService.clearPendingCheckupNotifications(user.getId());
                return;
            }
            if (isScheduledFor(user, scheduledAt)) {
                notificationService.createCheckupNotification(user, scheduledAt);
            }
        });
        log.debug("Mental state check-up notifications evaluated: scheduledAt={}", scheduledAt);
    }

    boolean isScheduledFor(User user, ZonedDateTime scheduledAt) {
        if (Boolean.FALSE.equals(user.getCheckupNotificationsEnabled())) {
            return false;
        }

        int intervalMinutes = user.getCheckupIntervalMinutes() == null
                ? DEFAULT_INTERVAL_MINUTES : user.getCheckupIntervalMinutes();
        LocalTime startTime = user.getCheckupStartTime() == null
                ? DEFAULT_START_TIME : user.getCheckupStartTime();
        int timesPerDay = user.getCheckupTimesPerDay() == null
                ? DEFAULT_TIMES_PER_DAY : user.getCheckupTimesPerDay();
        int currentMinute = scheduledAt.getHour() * 60 + scheduledAt.getMinute();
        int startMinute = startTime.getHour() * 60 + startTime.getMinute();
        int elapsedMinutes = currentMinute - startMinute;

        return elapsedMinutes >= 0
                && elapsedMinutes % intervalMinutes == 0
                && elapsedMinutes / intervalMinutes < timesPerDay;
    }
}
