package org.osama.path.scoring;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Pure scoring for path signals: a week's score per input, and inputs combined into one strength.
 * Weeks run Sunday to Saturday. The current week is judged against the days that have passed.
 */
public final class SignalScoring {
    /** Scores stop here, not at 1, so exceptional weeks stand out a little without hiding weak ones. */
    public static final double CAP = 1.25;
    public static final int DAYS_PER_WEEK = 7;

    private SignalScoring() {
    }

    public static LocalDate weekStart(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
    }

    /**
     * Scores one input for the week starting {@code weekStart}.
     *
     * @param loggedValues the stat's value per logged day; days absent from the map are unlogged
     * @param elapsedDays  how many days of the week count: 7 for a past week, 1 to 7 for the current one
     */
    public static InputWeekScore scoreWeek(InputRule rule, StatFacts facts, Map<LocalDate, Double> loggedValues,
                                           LocalDate weekStart, int elapsedDays) {
        int days = Math.max(1, Math.min(DAYS_PER_WEEK, elapsedDays));
        List<Double> logged = new ArrayList<>();
        List<Double> counted = new ArrayList<>();
        for (int offset = 0; offset < days; offset++) {
            Double value = loggedValues.get(weekStart.plusDays(offset));
            if (value != null) {
                logged.add(value);
                counted.add(value);
            } else if (facts.includeUnloggedDaysAsZero()) {
                counted.add(0.0);
            }
        }
        if (counted.isEmpty()) return InputWeekScore.NOTHING;
        boolean less = rule.direction() == InputDirection.LESS_IS_BETTER;
        double weekShare = rule.target() * days / DAYS_PER_WEEK;
        return switch (rule.scoring()) {
            case TIMES -> {
                double times = logged.stream().filter(facts::qualifies).count();
                yield new InputWeekScore(less ? lessRatio(weekShare, times) : ratio(times, weekShare), times);
            }
            case TOTAL -> {
                double sum = counted.stream().mapToDouble(Double::doubleValue).sum();
                yield new InputWeekScore(less ? lessRatio(weekShare, sum) : ratio(sum, weekShare), sum);
            }
            case DAYS_MET -> {
                double met = counted.stream().filter(value -> less ? value <= rule.target() : value >= rule.target()).count();
                yield new InputWeekScore(met / days, met);
            }
            case AVERAGE -> {
                double meanScore = counted.stream()
                        .mapToDouble(value -> less ? dayLessRatio(rule.target(), value) : ratio(value, rule.target()))
                        .average().orElse(0);
                double meanValue = counted.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                yield new InputWeekScore(cap(meanScore), meanValue);
            }
        };
    }

    /** Combines per-input scores into the signal's strength for one week. */
    public static double combine(List<Double> scores, List<Double> weights, SignalCombine method) {
        if (scores.isEmpty()) return 0;
        return switch (method) {
            case AVERAGE -> {
                double weighted = 0;
                double total = 0;
                for (int index = 0; index < scores.size(); index++) {
                    double weight = index < weights.size() ? weights.get(index) : 1;
                    weighted += scores.get(index) * weight;
                    total += weight;
                }
                yield total <= 0 ? 0 : cap(weighted / total);
            }
            case WEAKEST -> scores.stream().mapToDouble(Double::doubleValue).min().orElse(0);
            case ALL_MET -> {
                long met = scores.stream().filter(score -> score >= 1).count();
                if (met < scores.size()) yield (double) met / scores.size();
                yield cap(1 + scores.stream().mapToDouble(score -> score - 1).average().orElse(0));
            }
        };
    }

    private static double ratio(double achieved, double target) {
        if (target <= 0) return CAP;
        return cap(achieved / target);
    }

    // Doing nothing of a less-is-better thing is the best possible week.
    private static double lessRatio(double target, double achieved) {
        if (achieved <= 0) return CAP;
        return cap(target / achieved);
    }

    // A single day at zero is fully met; it does not count as exceptional.
    private static double dayLessRatio(double target, double value) {
        if (value <= 0) return 1;
        return cap(target / value);
    }

    private static double cap(double score) {
        return Math.max(0, Math.min(CAP, score));
    }
}
