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


    public Day createNewDay() {
        Day newDay = new Day();
        newDay.setDate(LocalDateTime.now().toLocalDate());
        return newDay;
    }
    public Optional<Day> getToday() {
        return dayRepository.findDayByDate(LocalDateTime.now().toLocalDate());
    }



}
