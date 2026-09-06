package org.osama.stat;

public final class StatTimeScale {

    public static final int MINUTES_PER_DAY = 24 * 60;
    public static final int BEDTIME_SCALE_START_MINUTES = 20 * 60;

    private StatTimeScale() {
    }

    public static boolean usesBedtimeScale(StatDefinition definition) {
        return SystemStatCatalog.SLEEP_TIME_SYSTEM_KEY.equals(definition.getSystemKey());
    }

    public static double toLinearValue(StatDefinition definition, double value) {
        if (!usesBedtimeScale(definition)) return value;
        return (value - BEDTIME_SCALE_START_MINUTES + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    }

    public static double fromLinearValue(StatDefinition definition, double value) {
        if (!usesBedtimeScale(definition)) return value;
        return (value + BEDTIME_SCALE_START_MINUTES) % MINUTES_PER_DAY;
    }
}
