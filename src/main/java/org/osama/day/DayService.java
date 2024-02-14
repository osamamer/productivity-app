package org.osama.day;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
@Service
@Slf4j
public class DayService {
    private final DayRepository dayRepository;
    public DayService(DayRepository dayRepository) {
        this.dayRepository = dayRepository;
    }
    public DayEntity createNewDay(LocalDate localDate) {
        DayEntity newDayEntity = new DayEntity();
        newDayEntity.setLocalDate(localDate);
        newDayEntity.setId(UUID.randomUUID().toString());
        return newDayEntity;
    }
    public DayEntity createNewDay() {
        return createNewDay(LocalDate.now());
    }
    public DayEntity getToday() {
        return dayRepository.findDayEntityByLocalDate(LocalDateTime.now().toLocalDate()).orElse(createNewDay());
    }
    public void setDayRating(String dateString, double rating) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDate(localDate).orElse(createNewDay(localDate));
        if (rating > 10) rating = 10;
        if (rating < 0) rating = 0;
        day.setRating(rating);
        dayRepository.save(day);
        log.info("Day {} rating set to {}", dateString, rating);
    }
    public void setDaySummary(String dateString, String summary) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDate(localDate).orElse(createNewDay(localDate));
        day.setSummary(summary);
        dayRepository.save(day);
    }
    public void setDayPlan(String dateString, String plan) {
        LocalDate localDate = stringToLocalDate(dateString);
        DayEntity day = dayRepository.findDayEntityByLocalDate(localDate).orElse(createNewDay(localDate));
        day.setPlan(plan);
        dayRepository.save(day);
    }
    private static LocalDate stringToLocalDate(String dateString) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        return LocalDate.parse(dateString, formatter);
    }
    public void setTodayRating(double rating) {
        DayEntity today = getToday();
        LocalDate localDate = today.getLocalDate();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        String formattedString = localDate.format(formatter);
        setDayRating(formattedString, rating);
    }
}
