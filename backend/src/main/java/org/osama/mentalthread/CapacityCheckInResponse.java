package org.osama.mentalthread;

import java.time.LocalDate;

public record CapacityCheckInResponse(
        LocalDate date,
        int capacity
) {
    public static CapacityCheckInResponse from(MentalCapacityCheckIn checkIn) {
        return new CapacityCheckInResponse(checkIn.getDate(), checkIn.getCapacity());
    }
}
