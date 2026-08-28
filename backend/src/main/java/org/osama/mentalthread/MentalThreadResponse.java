package org.osama.mentalthread;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record MentalThreadResponse(
        String id,
        String title,
        String description,
        MentalThreadStatus status,
        AttentionState attentionState,
        String desiredResolution,
        ClosureType closureType,
        String resolutionSummary,
        LocalDateTime openedAt,
        LocalDate targetCloseDate,
        LocalDate hardDeadlineDate,
        LocalDate nextReviewDate,
        LocalDateTime closedAt,
        int currentMentalLoad,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static MentalThreadResponse from(MentalThread mentalThread) {
        return new MentalThreadResponse(
                mentalThread.getId(),
                mentalThread.getTitle(),
                mentalThread.getDescription(),
                mentalThread.getStatus(),
                mentalThread.getAttentionState(),
                mentalThread.getDesiredResolution(),
                mentalThread.getClosureType(),
                mentalThread.getResolutionSummary(),
                mentalThread.getOpenedAt(),
                mentalThread.getTargetCloseDate(),
                mentalThread.getHardDeadlineDate(),
                mentalThread.getNextReviewDate(),
                mentalThread.getClosedAt(),
                mentalThread.getCurrentMentalLoad(),
                mentalThread.getCreatedAt(),
                mentalThread.getUpdatedAt()
        );
    }
}
