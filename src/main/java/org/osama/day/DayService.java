package org.osama.day;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class DayService {
    private final DayRepository dayRepository;

    public DayService(DayRepository dayRepository) {
        this.dayRepository = dayRepository;
    }


    public DayEntity createNewDay() {
        DayEntity newDayEntity = new DayEntity();
        newDayEntity.setDayDate(LocalDateTime.now().toLocalDate());
        return newDayEntity;
    }
    public Optional<DayEntity> getToday() {
        return dayRepository.findDayByDayDate(LocalDateTime.now().toLocalDate());
    }



}
