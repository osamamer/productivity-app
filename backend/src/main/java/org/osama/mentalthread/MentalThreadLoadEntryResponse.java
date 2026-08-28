package org.osama.mentalthread;

import java.time.LocalDateTime;

public record MentalThreadLoadEntryResponse(
        String id,
        int load,
        AttentionState attentionState,
        String reason,
        LocalDateTime recordedAt
) {
    public static MentalThreadLoadEntryResponse from(MentalThreadLoadEntry entry) {
        return new MentalThreadLoadEntryResponse(
                entry.getId(),
                entry.getLoad(),
                entry.getAttentionState(),
                entry.getReason(),
                entry.getRecordedAt()
        );
    }
}
