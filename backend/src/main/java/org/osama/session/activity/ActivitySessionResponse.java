package org.osama.session.activity;

import java.time.Instant;

public record ActivitySessionResponse(
        String id,
        String activityId,
        String eventId,
        String title,
        Instant startedAt,
        Instant endedAt,
        Instant pausedAt,
        long pausedMillis,
        Instant targetEndAt,
        long elapsedSeconds,
        boolean active,
        boolean paused
) {
    static ActivitySessionResponse from(ActivitySession session, Instant now) {
        return new ActivitySessionResponse(session.getId(), session.getActivityId(), session.getEventId(),
                session.getTitle(), session.getStartedAt(), session.getEndedAt(), session.getPausedAt(),
                session.getPausedMillis(), session.getTargetEndAt(), session.elapsed(now).toSeconds(),
                session.isActive(), session.isPaused());
    }
}
