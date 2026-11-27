package org.osama.path;

import lombok.RequiredArgsConstructor;
import org.osama.path.scoring.InputWeekScore;
import org.osama.path.scoring.SignalScoring;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatEntry;
import org.osama.stat.StatEntryRepository;
import org.osama.stat.StatEntryStatus;
import org.osama.stat.StatType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Loads stat entries and scores signals with {@link SignalScoring}; holds no scoring rules itself. */
@Service
@RequiredArgsConstructor
public class PathOverviewService {
    static final int DEFAULT_WEEKS = 52;
    static final int MAX_WEEKS = 520;
    static final int PREVIEW_WEEKS = 8;

    private final PathRepository pathRepository;
    private final PathService pathService;
    private final SignalFactory signalFactory;
    private final StatEntryRepository entryRepository;

    /**
     * Weekly strengths from the week holding {@code from} through the current week.
     * {@code today} is the user's local date; weeks after it are not scored yet.
     */
    @Transactional(readOnly = true)
    public PathOverviewResponse getOverview(LocalDate from, LocalDate today, String userId) {
        LocalDate currentWeek = SignalScoring.weekStart(today);
        LocalDate firstWeek = firstWeek(from, currentWeek, DEFAULT_WEEKS);
        List<Path> paths = pathRepository.findAllByUserIdOrderByDisplayOrderAscNameAsc(userId);
        List<PathResponse> described = pathService.describe(paths, userId);
        Map<String, StatDefinition> definitions = signalFactory.definitionsFor(
                paths.stream().map(Path::getSignal).toList(), userId);
        Map<String, List<StatEntry>> entries = loadEntries(definitions.keySet(), firstWeek, today, userId);
        List<PathOverviewResponse.PathRoad> roads = new ArrayList<>();
        for (int index = 0; index < paths.size(); index++) {
            roads.add(new PathOverviewResponse.PathRoad(described.get(index),
                    scoreWeeks(paths.get(index).getSignal(), definitions, entries, firstWeek, today)));
        }
        return new PathOverviewResponse(today, pathService.getView(userId), roads);
    }

    /** How an unsaved signal would have scored the last few weeks. Nothing is saved. */
    @Transactional(readOnly = true)
    public SignalPreviewResponse preview(SignalRequest request, LocalDate today, String userId) {
        PathSignal signal = signalFactory.build(request, null, userId);
        Map<String, StatDefinition> definitions = signalFactory.definitionsFor(List.of(signal), userId);
        LocalDate firstWeek = SignalScoring.weekStart(today).minusWeeks(PREVIEW_WEEKS - 1);
        Map<String, List<StatEntry>> entries = loadEntries(definitions.keySet(), firstWeek, today, userId);
        return new SignalPreviewResponse(signalFactory.describe(signal, definitions),
                scoreWeeks(signal, definitions, entries, firstWeek, today));
    }

    private static LocalDate firstWeek(LocalDate from, LocalDate currentWeek, int defaultWeeks) {
        LocalDate earliest = currentWeek.minusWeeks(MAX_WEEKS - 1);
        if (from == null) return currentWeek.minusWeeks(defaultWeeks - 1);
        LocalDate requested = SignalScoring.weekStart(from);
        if (requested.isAfter(currentWeek)) return currentWeek;
        return requested.isBefore(earliest) ? earliest : requested;
    }

    private Map<String, List<StatEntry>> loadEntries(Iterable<String> definitionIds, LocalDate from, LocalDate to,
                                                     String userId) {
        Map<String, List<StatEntry>> entries = new HashMap<>();
        for (String id : definitionIds) {
            entries.put(id, entryRepository.findAllByStatDefinitionIdAndUserIdAndDateBetween(id, userId, from, to));
        }
        return entries;
    }

    private static List<WeekStrength> scoreWeeks(PathSignal signal, Map<String, StatDefinition> definitions,
                                                 Map<String, List<StatEntry>> entries, LocalDate firstWeek,
                                                 LocalDate today) {
        List<PathSignalInput> inputs = signal.getInputs();
        List<Map<LocalDate, Double>> values = inputs.stream()
                .map(input -> loggedValues(entries.getOrDefault(input.getStatDefinitionId(), List.of()), input.getValueSource()))
                .toList();
        List<Double> weights = inputs.stream().map(PathSignalInput::getWeight).toList();
        LocalDate currentWeek = SignalScoring.weekStart(today);
        List<WeekStrength> weeks = new ArrayList<>();
        for (LocalDate week = firstWeek; !week.isAfter(currentWeek); week = week.plusWeeks(1)) {
            int elapsed = week.equals(currentWeek)
                    ? (int) ChronoUnit.DAYS.between(week, today) + 1
                    : SignalScoring.DAYS_PER_WEEK;
            List<WeekStrength.InputResult> results = new ArrayList<>();
            for (int index = 0; index < inputs.size(); index++) {
                PathSignalInput input = inputs.get(index);
                StatDefinition definition = definitions.get(input.getStatDefinitionId());
                InputWeekScore score = definition == null
                        ? new InputWeekScore(0, 0)
                        : SignalScoring.scoreWeek(input.rule(), SignalFactory.facts(definition, input.getValueSource()),
                                values.get(index), week, elapsed);
                results.add(new WeekStrength.InputResult(score.score(), score.achieved()));
            }
            double strength = SignalScoring.combine(
                    results.stream().map(WeekStrength.InputResult::score).toList(), weights, signal.getCombineMethod());
            weeks.add(new WeekStrength(week, elapsed, strength, results));
        }
        return weeks;
    }

    /** Recorded values per day from the chosen source; not-planned days and days missing that input are unlogged. */
    static Map<LocalDate, Double> loggedValues(List<StatEntry> entries, String valueSource) {
        Map<LocalDate, Double> values = new HashMap<>();
        boolean mainValue = PathSignalInput.MAIN_VALUE.equals(valueSource);
        StatType additional = mainValue ? null : StatType.valueOf(valueSource);
        for (StatEntry entry : entries) {
            if (entry.getStatus() == StatEntryStatus.NOT_PLANNED) continue;
            Double value = mainValue ? Double.valueOf(entry.getValue()) : entry.getAdditionalValues().get(additional);
            if (value != null) values.put(entry.getDate(), value);
        }
        return values;
    }
}
