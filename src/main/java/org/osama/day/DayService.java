package org.osama.day;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class DayService {
    private final DayRepository dayRepository;
    public DayService(DayRepository dayRepository) {
        this.dayRepository = dayRepository;
    }
    public DayEntity createNewDay() {
        DayEntity newDayEntity = new DayEntity();
        newDayEntity.setLocalDate(LocalDateTime.now().toLocalDate());
        newDayEntity.setId(UUID.randomUUID().toString());
        return newDayEntity;
    }
    public DayEntity getToday() {
        return dayRepository.findDayEntityByLocalDate(LocalDateTime.now().toLocalDate()).orElse(createNewDay());
    }
    public void setDayRating(DayEntity day, double rating) {
        if (rating > 10) rating = 10;
        if (rating < 0) rating = 0;
        day.setRating(rating);
        dayRepository.save(day);
        log.info("Rating set to {}", rating);
    }
}
