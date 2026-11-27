package org.osama.path.scoring;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.osama.path.scoring.InputDirection.LESS_IS_BETTER;
import static org.osama.path.scoring.InputDirection.MORE_IS_BETTER;

class SignalScoringTest {
    private static final LocalDate SUNDAY = LocalDate.of(2026, 11, 22);
    private static final double DELTA = 1e-9;
    private static final StatFacts LOGGED_ONLY = StatFacts.PLAIN;
    private static final StatFacts UNLOGGED_IS_ZERO = new StatFacts(true, null, null);

    /** Values for consecutive days from Sunday; null leaves a day unlogged. */
    private static Map<LocalDate, Double> week(Double... values) {
        Map<LocalDate, Double> days = new HashMap<>();
        for (int offset = 0; offset < values.length; offset++) {
            if (values[offset] != null) days.put(SUNDAY.plusDays(offset), values[offset]);
        }
        return days;
    }

    private static InputWeekScore score(InputScoring scoring, InputDirection direction, double target,
                                        StatFacts facts, Map<LocalDate, Double> values) {
        return SignalScoring.scoreWeek(new InputRule(scoring, direction, target, 1), facts, values, SUNDAY, 7);
    }

    @Test
    void weeksStartOnSunday() {
        assertEquals(SUNDAY, SignalScoring.weekStart(LocalDate.of(2026, 11, 26)));
        assertEquals(SUNDAY, SignalScoring.weekStart(SUNDAY));
        assertEquals(SUNDAY, SignalScoring.weekStart(LocalDate.of(2026, 11, 28)));
    }

    @Nested
    class Times {
        @Test
        void countsDaysWithANonZeroEntryAgainstTheWeeklyTarget() {
            InputWeekScore gym = score(InputScoring.TIMES, MORE_IS_BETTER, 4, LOGGED_ONLY, week(1.0, 0.0, 1.0, null, 1.0));

            assertEquals(3, gym.achieved(), DELTA);
            assertEquals(0.75, gym.score(), DELTA);
        }

        @Test
        void usesTheStatsGoodThresholdWhenItHasOne() {
            StatFacts atLeastThirty = new StatFacts(false, 30.0, true);

            InputWeekScore runs = score(InputScoring.TIMES, MORE_IS_BETTER, 2, atLeastThirty, week(20.0, 30.0, 45.0));

            assertEquals(2, runs.achieved(), DELTA);
            assertEquals(1, runs.score(), DELTA);
        }

        @Test
        void exceptionalWeeksStopAtTheCap() {
            InputWeekScore gym = score(InputScoring.TIMES, MORE_IS_BETTER, 2, LOGGED_ONLY, week(1.0, 1.0, 1.0, 1.0, 1.0));

            assertEquals(SignalScoring.CAP, gym.score(), DELTA);
        }

        @Test
        void theCurrentWeekIsJudgedAgainstTheDaysThatHavePassed() {
            // Thursday, 2 of 4 gym sessions: the target so far is 4 × 5/7.
            InputWeekScore gym = SignalScoring.scoreWeek(new InputRule(InputScoring.TIMES, MORE_IS_BETTER, 4, 1),
                    LOGGED_ONLY, week(1.0, null, 1.0), SUNDAY, 5);

            assertEquals(2 / (4 * 5 / 7.0), gym.score(), DELTA);
        }

        @Test
        void lessIsBetterFlipsTheRatio() {
            InputWeekScore takeaways = score(InputScoring.TIMES, LESS_IS_BETTER, 1, LOGGED_ONLY, week(1.0, 1.0, 0.0));

            assertEquals(0.5, takeaways.score(), DELTA);
        }
    }

    @Nested
    class Total {
        @Test
        void sumsTheWeeksValuesAgainstTheTarget() {
            InputWeekScore words = score(InputScoring.TOTAL, MORE_IS_BETTER, 2600, LOGGED_ONLY, week(500.0, 800.0, null, 1000.0));

            assertEquals(2300, words.achieved(), DELTA);
            assertEquals(2300 / 2600.0, words.score(), DELTA);
        }

        @Test
        void lessIsBetterScoresTargetOverSumAndNothingAtAllIsTheBestWeek() {
            assertEquals(0.5, score(InputScoring.TOTAL, LESS_IS_BETTER, 100, LOGGED_ONLY, week(150.0, 50.0)).score(), DELTA);
            assertEquals(SignalScoring.CAP, score(InputScoring.TOTAL, LESS_IS_BETTER, 100, LOGGED_ONLY, week(0.0)).score(), DELTA);
        }
    }

    @Nested
    class DaysMet {
        @Test
        void countsDaysMeetingTheDailyTargetOutOfSeven() {
            InputWeekScore protein = score(InputScoring.DAYS_MET, MORE_IS_BETTER, 120, LOGGED_ONLY,
                    week(130.0, 90.0, 120.0, 140.0, null, 125.0, 100.0));

            assertEquals(4, protein.achieved(), DELTA);
            assertEquals(4 / 7.0, protein.score(), DELTA);
        }

        @Test
        void lessIsBetterMeetsAtOrUnderTheTargetAndZeroCounts() {
            InputWeekScore sugar = score(InputScoring.DAYS_MET, LESS_IS_BETTER, 30, UNLOGGED_IS_ZERO, week(40.0, 30.0));

            // Sunday misses; Monday meets; the five unlogged days count as zero, which meets.
            assertEquals(6 / 7.0, sugar.score(), DELTA);
        }
    }

    @Nested
    class Average {
        @Test
        void partialDaysCount() {
            InputWeekScore protein = score(InputScoring.AVERAGE, MORE_IS_BETTER, 100, LOGGED_ONLY, week(100.0, 50.0));

            assertEquals(0.75, protein.score(), DELTA);
            assertEquals(75, protein.achieved(), DELTA);
        }

        @Test
        void leavesUnloggedDaysOutUnlessTheStatCountsThemAsZero() {
            Map<LocalDate, Double> twoDays = week(100.0, 100.0);

            assertEquals(1, score(InputScoring.AVERAGE, MORE_IS_BETTER, 100, LOGGED_ONLY, twoDays).score(), DELTA);
            assertEquals(2 / 7.0, score(InputScoring.AVERAGE, MORE_IS_BETTER, 100, UNLOGGED_IS_ZERO, twoDays).score(), DELTA);
        }

        @Test
        void lessIsBetterScoresEachDayAsTargetOverValueWithZeroFullyMet() {
            InputWeekScore screen = score(InputScoring.AVERAGE, LESS_IS_BETTER, 60, LOGGED_ONLY, week(120.0, 0.0));

            assertEquals((0.5 + 1) / 2, screen.score(), DELTA);
        }
    }

    @Test
    void aWeekWithNothingLoggedScoresZeroEvenForLessIsBetter() {
        assertEquals(0, score(InputScoring.TOTAL, LESS_IS_BETTER, 100, LOGGED_ONLY, week()).score(), DELTA);
        assertEquals(0, score(InputScoring.DAYS_MET, MORE_IS_BETTER, 1, LOGGED_ONLY, week()).score(), DELTA);
    }

    @Nested
    class Combining {
        @Test
        void averageIsWeighted() {
            assertEquals(0.75, SignalScoring.combine(List.of(1.0, 0.5), List.of(1.0, 1.0), SignalCombine.AVERAGE), DELTA);
            assertEquals(5 / 6.0, SignalScoring.combine(List.of(1.0, 0.5), List.of(2.0, 1.0), SignalCombine.AVERAGE), DELTA);
        }

        @Test
        void weakestTakesTheLowestScore() {
            assertEquals(0.4, SignalScoring.combine(List.of(1.2, 0.4, 0.9), List.of(), SignalCombine.WEAKEST), DELTA);
        }

        @Test
        void allMetIsTheShareOfInputsMetUntilAllAre() {
            assertEquals(2 / 3.0, SignalScoring.combine(List.of(1.0, 1.1, 0.9), List.of(), SignalCombine.ALL_MET), DELTA);
        }

        @Test
        void allMetAddsTheMeanExcessOnceEveryInputIsMet() {
            assertEquals(1.1, SignalScoring.combine(List.of(1.0, 1.2), List.of(), SignalCombine.ALL_MET), DELTA);
        }

        @Test
        void noInputsIsZero() {
            assertEquals(0, SignalScoring.combine(List.of(), List.of(), SignalCombine.AVERAGE), DELTA);
        }
    }
}
