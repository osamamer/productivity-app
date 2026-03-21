package org.osama.day;

import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@Slf4j
public class DayService {
    private final DayRepository dayRepository;
    private final UserRepository userRepository;

    public DayService(DayRepository dayRepository, UserRepository userRepository) {
        this.dayRepository = dayRepository;
        this.userRepository = userRepository;
    }

    public DayEntity createNewDay(LocalDate localDate, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));
        DayEntity newDayEntity = new DayEntity();
        newDayEntity.setLocalDate(localDate);
        newDayEntity.setId(UUID.randomUUID().toString());
        newDayEntity.setUser(user);
        return newDayEntity;
    }

    public DayEntity getToday(String userId) {
        return dayRepository.findDayEntityByLocalDateAndUserId(LocalDate.now(), userId)
                .orElse(createNewDay(LocalDate.now(), userId));
    }

    public void setTodayInfo(double rating, String plan, String summary, String userId) {
        DayEntity today = dayRepository.findDayEntityByLocalDateAndUserId(LocalDate.now(), userId)
                .orElse(createNewDay(LocalDate.now(), userId));
        today.setRating(rating);
        today.setPlan(plan);
        today.setSummary(summary);
        dayRepository.save(today);
    }

    public void setDayRating(String dateString, double rating, String userId) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDateAndUserId(localDate, userId)
                .orElse(createNewDay(localDate, userId));
        if (rating > 10) rating = 10;
        if (rating < 0) rating = 0;
        day.setRating(rating);
        dayRepository.save(day);
        log.info("Day {} rating set to {}", dateString, rating);
    }

    public void setDaySummary(String dateString, String summary, String userId) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDateAndUserId(localDate, userId)
                .orElse(createNewDay(localDate, userId));
        day.setSummary(summary);
        dayRepository.save(day);
    }

    public void setDayPlan(String dateString, String plan, String userId) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDateAndUserId(localDate, userId)
                .orElse(createNewDay(localDate, userId));
        day.setPlan(plan);
        dayRepository.save(day);
    }

    public String getDaySummary(String dateString, String userId) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDateAndUserId(localDate, userId)
                .orElse(createNewDay(localDate, userId));
        return day.getSummary();
    }

    public String getDayPlan(String dateString, String userId) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDateAndUserId(localDate, userId)
                .orElse(createNewDay(localDate, userId));
        return day.getPlan();
    }

    public void setTodayRating(double rating, String userId) {
        DayEntity today = getToday(userId);
        LocalDate localDate = today.getLocalDate();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        String formattedString = localDate.format(formatter);
        setDayRating(formattedString, rating, userId);
    }

    private static LocalDate stringToLocalDate(String dateString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        return LocalDate.parse(dateString, formatter);
    }
}