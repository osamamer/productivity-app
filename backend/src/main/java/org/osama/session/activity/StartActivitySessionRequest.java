package org.osama.session.activity;

import java.time.Instant;

/**
 * Starts a timer. {@code title} defaults to the activity's name; {@code targetEndAt} makes it a
 * countdown (for example to the end of the chunk it was started from).
 */
public record StartActivitySessionRequest(String activityId, String eventId, String title, Instant targetEndAt) {
}
