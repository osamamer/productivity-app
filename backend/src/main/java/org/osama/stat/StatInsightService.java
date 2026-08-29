package org.osama.stat;

import org.osama.exceptions.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class StatInsightService {

    private static final int MIN_OVERLAP_DAYS = 5;
    private static final double MEANINGFUL_CORRELATION = 0.30;

    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;

    public StatInsightService(StatDefinitionRepository definitionRepository,
                              StatEntryRepository entryRepository) {
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
    }

    public StatInsightsResponse getInsights(String definitionId, LocalDate from, LocalDate to, String userId) {
        StatDefinition driver = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        validatePeriod(from, to);

        List<StatDefinition> definitions = definitionRepository.findAllByUserIdOrderByDisplayOrderAsc(userId);
        List<StatEntry> entries = entryRepository.findAllByUserIdAndDateBetween(userId, from, to);
        Map<String, Map<LocalDate, Double>> valuesByDefinition = entries.stream()
                .filter(entry -> entry.getStatDefinition() != null)
                .collect(Collectors.groupingBy(
                        entry -> entry.getStatDefinition().getId(),
                        Collectors.toMap(StatEntry::getDate, StatEntry::getValue)));

        List<StatCorrelationResponse> correlations = definitions.stream()
                .filter(definition -> !SystemStatCatalog.isMentalStateSystemKey(definition.getSystemKey()))
                .filter(definition -> !definition.getId().equals(driver.getId()))
                .map(definition -> correlate(driver, definition,
                        valuesByDefinition.getOrDefault(driver.getId(), Map.of()),
                        valuesByDefinition.getOrDefault(definition.getId(), Map.of())))
                .sorted(Comparator
                        .comparing(StatCorrelationResponse::meaningful).reversed()
                        .thenComparing(response -> absoluteCorrelation(response.correlation()), Comparator.reverseOrder())
                        .thenComparing(StatCorrelationResponse::statName, String.CASE_INSENSITIVE_ORDER))
                .toList();

        return new StatInsightsResponse(driver.getId(), driver.getName(), from, to,
                valuesByDefinition.getOrDefault(driver.getId(), Map.of()).size(), correlations);
    }

    private StatCorrelationResponse correlate(StatDefinition driver, StatDefinition other,
                                              Map<LocalDate, Double> driverValues,
                                              Map<LocalDate, Double> otherValues) {
        List<PairedValue> pairs = driverValues.entrySet().stream()
                .filter(entry -> otherValues.containsKey(entry.getKey()))
                .map(entry -> new PairedValue(entry.getValue(), otherValues.get(entry.getKey())))
                .filter(pair -> Double.isFinite(pair.driver()) && Double.isFinite(pair.other()))
                .toList();

        double[] driverStats = averagesAndVariance(pairs, true);
        double[] otherStats = averagesAndVariance(pairs, false);
        Double correlation = calculateCorrelation(pairs, driverStats[0], otherStats[0],
                driverStats[1], otherStats[1]);
        String strength = getStrength(correlation, pairs.size());
        String direction = getDirection(correlation);
        boolean meaningful = correlation != null && Math.abs(correlation) >= MEANINGFUL_CORRELATION;

        double driverAverage = driverStats[0];
        List<Double> otherWhenDriverHigher = pairs.stream()
                .filter(pair -> isDriverHigher(driver, pair, driverAverage))
                .map(PairedValue::other)
                .toList();
        List<Double> otherWhenDriverLower = pairs.stream()
                .filter(pair -> !isDriverHigher(driver, pair, driverAverage))
                .map(PairedValue::other)
                .toList();
        Double highAverage = average(otherWhenDriverHigher);
        Double lowAverage = average(otherWhenDriverLower);

        String insight = buildInsight(driver, other, pairs.size(), correlation, strength,
                highAverage, lowAverage);
        return new StatCorrelationResponse(other.getId(), other.getName(), other.getType(), pairs.size(),
                correlation, strength, direction, meaningful, highAverage, lowAverage, insight);
    }

    private double[] averagesAndVariance(List<PairedValue> pairs, boolean driver) {
        if (pairs.isEmpty()) return new double[]{0.0, 0.0};
        double average = pairs.stream()
                .mapToDouble(pair -> driver ? pair.driver() : pair.other())
                .average()
                .orElse(0.0);
        double variance = pairs.stream()
                .mapToDouble(pair -> {
                    double value = driver ? pair.driver() : pair.other();
                    return Math.pow(value - average, 2);
                })
                .sum();
        return new double[]{average, variance};
    }

    private Double calculateCorrelation(List<PairedValue> pairs, double driverAverage, double otherAverage,
                                        double driverVariance, double otherVariance) {
        if (pairs.size() < MIN_OVERLAP_DAYS || driverVariance == 0.0 || otherVariance == 0.0) {
            return null;
        }
        double covariance = pairs.stream()
                .mapToDouble(pair -> (pair.driver() - driverAverage) * (pair.other() - otherAverage))
                .sum();
        return covariance / Math.sqrt(driverVariance * otherVariance);
    }

    private String getStrength(Double correlation, int overlapDays) {
        if (correlation == null) return overlapDays < MIN_OVERLAP_DAYS ? "INSUFFICIENT_DATA" : "NO_VARIATION";
        double absolute = Math.abs(correlation);
        if (absolute >= 0.70) return "STRONG";
        if (absolute >= 0.50) return "MODERATE";
        if (absolute >= MEANINGFUL_CORRELATION) return "MILD";
        return "NONE";
    }

    private String getDirection(Double correlation) {
        if (correlation == null || Math.abs(correlation) < MEANINGFUL_CORRELATION) return "NONE";
        return correlation > 0 ? "POSITIVE" : "NEGATIVE";
    }

    private String buildInsight(StatDefinition driver, StatDefinition other, int overlapDays,
                                Double correlation, String strength,
                                Double highAverage, Double lowAverage) {
        if (overlapDays < MIN_OVERLAP_DAYS) {
            return "Not enough shared entries yet. Add this stat on at least "
                    + (MIN_OVERLAP_DAYS - overlapDays) + " more day"
                    + (MIN_OVERLAP_DAYS - overlapDays == 1 ? "" : "s") + " to look for a pattern.";
        }
        if (correlation == null) {
            return "There is not enough variation in these shared entries to identify a pattern yet.";
        }
        if (Math.abs(correlation) < MEANINGFUL_CORRELATION) {
            return "No clear relationship between " + driver.getName() + " and " + other.getName()
                    + " yet across " + overlapDays + " shared days.";
        }

        String driverPhrase = driver.getType() == StatType.BOOLEAN
                ? "you marked " + driver.getName() + " yes"
                : driver.getName() + " was higher";
        String comparison = other.getType() == StatType.BOOLEAN
                ? correlation > 0 ? "was marked yes more often" : "was marked yes less often"
                : correlation > 0 ? "was also higher" : "was lower";
        String highLow = highAverage != null && lowAverage != null
                ? String.format(Locale.ROOT, ": %s vs %s on average",
                formatValue(highAverage, other.getType()), formatValue(lowAverage, other.getType()))
                : "";
        return String.format(Locale.ROOT,
                "On days %s, %s %s%s. This is a %s %s relationship across %d shared days (r = %.2f).",
                driverPhrase, other.getName(), comparison, highLow,
                strength.toLowerCase(Locale.ROOT), correlation > 0 ? "positive" : "negative",
                overlapDays, correlation);
    }

    private Double average(List<Double> values) {
        return values.isEmpty() ? null : values.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
    }

    private boolean isDriverHigher(StatDefinition driver, PairedValue pair, double driverAverage) {
        return driver.getType() == StatType.BOOLEAN ? pair.driver() == 1.0 : pair.driver() >= driverAverage;
    }

    private String formatValue(double value, StatType type) {
        if (type == StatType.BOOLEAN) {
            return String.format(Locale.ROOT, "%.0f%%", value * 100);
        }
        return String.format(Locale.ROOT, "%.1f", value).replaceAll("\\.0$", "");
    }

    private double absoluteCorrelation(Double correlation) {
        return correlation == null ? -1.0 : Math.abs(correlation);
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("The insight period must have a valid start and end date.");
        }
    }

    private record PairedValue(double driver, double other) {
    }
}
