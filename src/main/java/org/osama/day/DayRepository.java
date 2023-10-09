package org.osama.day;

public interface DayRepository {
    void add(Day day);
    Day getCurrentDay();
}
