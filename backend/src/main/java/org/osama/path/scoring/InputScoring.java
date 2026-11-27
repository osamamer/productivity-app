package org.osama.path.scoring;

/** How one input scores a week. WEEK-period inputs use TIMES or TOTAL, DAY-period inputs DAYS_MET or AVERAGE. */
public enum InputScoring {
    TIMES(InputPeriod.WEEK),
    TOTAL(InputPeriod.WEEK),
    DAYS_MET(InputPeriod.DAY),
    AVERAGE(InputPeriod.DAY);

    private final InputPeriod period;

    InputScoring(InputPeriod period) {
        this.period = period;
    }

    public InputPeriod period() {
        return period;
    }
}
