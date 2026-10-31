package org.osama.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CalendarEventReminderPreferenceRepository
        extends JpaRepository<CalendarEventReminderPreference, String> {
    Optional<CalendarEventReminderPreference> findBySourceIdAndSeriesKeyAndExternalKeyIsNull(
            String sourceId, String seriesKey);

    Optional<CalendarEventReminderPreference> findBySourceIdAndExternalKey(String sourceId, String externalKey);

    @Modifying
    @Query("update CalendarEventReminderPreference preference set preference.softDeleted = true "
            + "where preference.sourceId = :sourceId and preference.seriesKey = :seriesKey "
            + "and preference.externalKey is not null and preference.softDeleted = false")
    int softDeleteOccurrencePreferences(@Param("sourceId") String sourceId,
                                        @Param("seriesKey") String seriesKey);

    @Modifying
    @Query("update CalendarEventReminderPreference preference set preference.softDeleted = true "
            + "where preference.sourceId = :sourceId and preference.softDeleted = false")
    int softDeleteBySourceId(@Param("sourceId") String sourceId);
}
