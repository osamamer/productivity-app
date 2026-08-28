package org.osama.mentalthread;

import java.time.LocalDateTime;

public record MentalThreadLoadEntryResponse(
        String id,
        int load,
        String reason,
        LocalDateTime recordedAt
) {
    public static MentalThreadLoadEntryResponse from(MentalThreadLoadEntry entry) {
        return new MentalThreadLoadEntryResponse(
                entry.getId(),
                entry.getLoad(),
                entry.getReason(),
                entry.getRecordedAt()
        );
    }
}
