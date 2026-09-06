package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Component
@Profile("dev")
@Slf4j
public class DevSleepStatDataSeeder {

    private static final int HISTORY_DAYS = 365;

    private final UserRepository userRepository;
    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;
    private final StatService statService;
    private final SystemStatProvisioningService provisioningService;

    public DevSleepStatDataSeeder(UserRepository userRepository,
                                  StatDefinitionRepository definitionRepository,
                                  StatEntryRepository entryRepository,
                                  StatService statService,
                                  SystemStatProvisioningService provisioningService) {
        this.userRepository = userRepository;
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
        this.statService = statService;
        this.provisioningService = provisioningService;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Order(Ordered.LOWEST_PRECEDENCE)
    @Transactional
    public void seedMissingSleepTimes() {
        LocalDate today = LocalDate.now();
        int createdCount = 0;
        for (User user : userRepository.findAll()) {
            provisioningService.createMissingSystemStatsFor(user);
            StatDefinition sleepTime = definitionRepository
                    .findByUserIdAndSystemKey(user.getId(), SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY)
                    .orElseThrow();
            StatDefinition wakeUpTime = definitionRepository
                    .findByUserIdAndSystemKey(user.getId(), SystemStatCatalog.WAKE_UP_TIME_SYSTEM_KEY)
                    .orElseThrow();
            createdCount += seedUser(user, sleepTime, wakeUpTime, today);
        }
        if (createdCount > 0) {
            log.info("Development sleep and wake-up samples created through stat service: entryCount={}", createdCount);
        }
    }

    private int seedUser(User user, StatDefinition sleepTime, StatDefinition wakeUpTime, LocalDate today) {
        return seedDefinition(user, sleepTime, today, this::sampleBedtime)
                + seedDefinition(user, wakeUpTime, today, this::sampleWakeUp);
    }

    private int seedDefinition(User user, StatDefinition definition, LocalDate today, SampleValue sampleValue) {
        LocalDate firstDate = today.minusDays(HISTORY_DAYS - 1L);
        Set<LocalDate> existingDates = new HashSet<>(entryRepository
                .findAllByStatDefinitionIdAndUserIdAndDateBetween(
                        definition.getId(), user.getId(), firstDate, today)
                .stream()
                .map(StatEntry::getDate)
                .toList());
        int createdCount = 0;

        for (int daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
            LocalDate date = today.minusDays(daysAgo);
            if (existingDates.contains(date) || daysAgo % 17 == 5) continue;
            // Keep dev data on the same validation/write path as POST /api/v1/stats/entries.
            statService.recordEntry(definition.getId(), date, sampleValue.value(date, daysAgo), user.getId());
            createdCount++;
        }

        return createdCount;
    }

    private double sampleBedtime(LocalDate date, int daysAgo) {
        boolean weekend = date.getDayOfWeek() == DayOfWeek.FRIDAY
                || date.getDayOfWeek() == DayOfWeek.SATURDAY;
        double minutesAfterEightPm = (weekend ? 270 : 205)
                + 32 * Math.sin(daysAgo * 0.31)
                + 18 * Math.sin(daysAgo * 0.09);
        if (daysAgo % 29 == 0) minutesAfterEightPm += 105;
        double bounded = Math.max(75, Math.min(540, Math.round(minutesAfterEightPm / 5) * 5));
        return (bounded + StatTimeScale.BEDTIME_SCALE_START_MINUTES) % StatTimeScale.MINUTES_PER_DAY;
    }

    private double sampleWakeUp(LocalDate date, int daysAgo) {
        boolean weekend = date.getDayOfWeek() == DayOfWeek.FRIDAY
                || date.getDayOfWeek() == DayOfWeek.SATURDAY;
        double minutesAfterMidnight = (weekend ? 515 : 430)
                + 24 * Math.sin(daysAgo * 0.27)
                + 16 * Math.sin(daysAgo * 0.08);
        if (daysAgo % 31 == 0) minutesAfterMidnight += 55;
        return Math.max(300, Math.min(720, Math.round(minutesAfterMidnight / 5) * 5));
    }

    @FunctionalInterface
    private interface SampleValue {
        double value(LocalDate date, int daysAgo);
    }
}
