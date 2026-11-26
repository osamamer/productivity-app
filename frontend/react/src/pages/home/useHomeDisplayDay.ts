import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { dateKey } from '../../services/utils/taskDate';
import { getHomeDisplayDate, getNextHomeDayBoundary } from '../../services/utils/homeDay';
import { getRuntimeUserPreference, subscribeToUserPreferences } from '../../services/userPreferenceStore';

/** The day Home shows, which rolls over at the user's configured day-end hour rather than midnight. */
export function useHomeDisplayDay() {
    const homeDayEndHour = useSyncExternalStore(
        subscribeToUserPreferences,
        () => getRuntimeUserPreference('homeDayEndHour'),
        () => 0,
    );
    const [clockTime, setClockTime] = useState(() => new Date());
    const homeDisplayDay = useMemo(() => getHomeDisplayDate(clockTime, homeDayEndHour), [clockTime, homeDayEndHour]);
    const homeDisplayDayKey = dateKey(homeDisplayDay);

    useEffect(() => {
        const nextBoundary = getNextHomeDayBoundary(new Date(), homeDayEndHour);
        const timeout = window.setTimeout(
            () => setClockTime(new Date()),
            Math.max(0, nextBoundary.getTime() - Date.now()) + 25,
        );
        return () => window.clearTimeout(timeout);
    }, [homeDayEndHour, homeDisplayDayKey]);

    return { homeDisplayDay, homeDisplayDayKey, homeDayEndHour };
}
