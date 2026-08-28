package org.osama.mentalthread;

public record MentalThreadSummaryResponse(
        int openThreadCount,
        int totalLoad,
        int highLoadCount,
        int actingCount,
        int ruminatingCount,
        int plannedCount,
        int pendingCount,
        Integer capacityToday
) {
}
