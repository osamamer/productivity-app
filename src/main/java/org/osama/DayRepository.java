package org.osama;

import java.util.List;

public interface DayRepository {
    void add(Day day);
    Day getCurrentDay();
}
