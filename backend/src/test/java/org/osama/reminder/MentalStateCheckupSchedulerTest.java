package org.osama.reminder;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MentalStateCheckupSchedulerTest {
    private static final ZoneId ZONE = ZoneId.of("UTC");

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Test
    void schedulesAConfiguredCheckupAtTheMatchingMinute() {
        User user = user(true, LocalTime.of(9, 0), 90, 3);
        ZonedDateTime now = ZonedDateTime.of(2026, 9, 5, 10, 30, 47, 0, ZONE);
        when(userRepository.findAllByActiveTrue()).thenReturn(List.of(user));

        newScheduler(now).createDueCheckups();

        verify(notificationService).createCheckupNotification(user, now.withSecond(0).withNano(0));
    }

    @Test
    void doesNotScheduleWhenNotificationsAreDisabledOrTheDailyCountIsExhausted() {
        User disabled = user(false, LocalTime.of(9, 0), 60, 4);
        User exhausted = user(true, LocalTime.of(9, 0), 60, 2);
        ZonedDateTime now = ZonedDateTime.of(2026, 9, 5, 12, 0, 0, 0, ZONE);
        when(userRepository.findAllByActiveTrue()).thenReturn(List.of(disabled, exhausted));

        newScheduler(now).createDueCheckups();

        verify(notificationService).clearPendingCheckupNotifications(disabled.getId());
        verify(notificationService, never()).createCheckupNotification(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    private MentalStateCheckupScheduler newScheduler(ZonedDateTime now) {
        return new MentalStateCheckupScheduler(
                userRepository,
                notificationService,
                Clock.fixed(now.toInstant(), ZONE));
    }

    private User user(boolean enabled, LocalTime startTime, int intervalMinutes, int timesPerDay) {
        return User.builder()
                .id("checkup-user-" + enabled + "-" + intervalMinutes + "-" + timesPerDay)
                .email("checkup-" + enabled + "-" + intervalMinutes + "-" + timesPerDay + "@example.com")
                .firstName("Checkup")
                .lastName("Tester")
                .username("checkup-" + enabled + "-" + intervalMinutes + "-" + timesPerDay)
                .active(true)
                .checkupNotificationsEnabled(enabled)
                .checkupStartTime(startTime)
                .checkupIntervalMinutes(intervalMinutes)
                .checkupTimesPerDay(timesPerDay)
                .build();
    }
}
