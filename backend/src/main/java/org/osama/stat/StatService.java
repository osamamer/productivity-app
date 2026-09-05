package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@Slf4j
public class StatService {

    private final StatDefinitionRepository definitionRepository;
    private final StatEntryRepository entryRepository;
    private final UserRepository userRepository;
    private final StatGroupService statGroupService;

    public StatService(StatDefinitionRepository definitionRepository,
                       StatEntryRepository entryRepository,
                       UserRepository userRepository,
                       StatGroupService statGroupService) {
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
        this.statGroupService = statGroupService;
    }

    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue, String userId) {
        return createDefinition(name, description, type, minValue, maxValue,
                null, null, userId);
    }

    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue,
                                           StatMorality morality, Double goodThreshold,
                                           String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        validateDefinition(name, type, minValue, maxValue, morality, goodThreshold, userId, null);
        return saveDefinition(name, description, type, minValue, maxValue,
                morality, goodThreshold, null, user);
    }

    @Transactional
    public StatDefinition updateDefinition(String definitionId, String name, String description,
                                           StatMorality morality, Double goodThreshold,
                                           String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (definition.getSystemKey() != null) {
            throw new IllegalArgumentException("Cannot edit a system stat.");
        }

        validateDefinition(name, definition.getType(), definition.getMinValue(),
                definition.getMaxValue(), morality, goodThreshold, userId, definitionId);
        definition.setName(name);
        definition.setDescription(description);
        definition.setMorality(morality);
        definition.setGoodThreshold(goodThreshold);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat definition updated: userId={} statDefinitionId={} name={} morality={} goodThreshold={}",
                userId, savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getMorality(), savedDefinition.getGoodThreshold());
        return savedDefinition;
    }

    StatDefinition createSystemDefinition(SystemStatDefinition systemStat, User user) {
        validateDefinition(systemStat.name(), systemStat.type(), systemStat.minValue(),
                systemStat.maxValue(), systemStat.morality(), systemStat.goodThreshold(),
                user.getId(), null);
        return saveDefinition(systemStat.name(), systemStat.description(), systemStat.type(),
                systemStat.minValue(), systemStat.maxValue(), systemStat.morality(),
                systemStat.goodThreshold(),
                systemStat.systemKey(), user);
    }

    private void validateDefinition(String name, StatType type, Double minValue,
                                    Double maxValue, StatMorality morality,
                                    Double goodThreshold, String userId,
                                    String excludedDefinitionId) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A stat must have a name.");
        }
        if (type == null) {
            throw new IllegalArgumentException("A stat must have a type.");
        }
        Optional<StatDefinition> sameName = definitionRepository.findByUserIdAndNameIgnoreCase(userId, name);
        if (sameName.isPresent() && !sameName.get().getId().equals(excludedDefinitionId)) {
            throw new IllegalArgumentException("A stat with that name already exists.");
        }
        if (type == StatType.RANGE) {
            if (minValue == null || maxValue == null || minValue.isNaN()
                    || maxValue.isNaN() || !Double.isFinite(minValue)
                    || !Double.isFinite(maxValue) || minValue > maxValue) {
                throw new IllegalArgumentException("Invalid range for stat.");
            }
        }
        if ((type == StatType.TIME || type == StatType.DURATION)
                && (minValue != null || maxValue != null)) {
            throw new IllegalArgumentException("Time and duration stats do not use range bounds.");
        }
        if (type == StatType.TIME && goodThreshold != null) {
            throw new IllegalArgumentException("Time stats do not use a good threshold.");
        }
        if (morality == null || morality == StatMorality.NEUTRAL) {
            if (goodThreshold != null) {
                throw new IllegalArgumentException("A neutral stat cannot have a good threshold.");
            }
            return;
        }
        if (type == StatType.BOOLEAN) {
            if (goodThreshold != null) {
                throw new IllegalArgumentException("Boolean stats do not use a good threshold.");
            }
            return;
        }
        if (goodThreshold == null || !Double.isFinite(goodThreshold)) {
            throw new IllegalArgumentException("A non-neutral numeric stat must have a good threshold.");
        }
        if (type == StatType.RANGE
                && (goodThreshold < minValue || goodThreshold > maxValue)) {
            throw new IllegalArgumentException("The good threshold must be inside the stat range.");
        }
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue,
                                          StatMorality morality, Double goodThreshold,
                                          String systemKey,
                                          User user) {
        StatDefinition definition = new StatDefinition();
        definition.setId(UUID.randomUUID().toString());
        definition.setName(name);
        definition.setDescription(description);
        definition.setType(type);
        definition.setMorality(morality);
        definition.setMinValue(minValue);
        definition.setMaxValue(maxValue);
        definition.setGoodThreshold(goodThreshold);
        definition.setSystemKey(systemKey);
        definition.setDisplayOrder(nextDisplayOrder(user.getId()));
        definition.setUser(user);
        StatDefinition savedDefinition = definitionRepository.save(definition);
        log.info("Stat definition created: userId={} statDefinitionId={} name={} type={} systemKey={}",
                user.getId(), savedDefinition.getId(), savedDefinition.getName(),
                savedDefinition.getType(), savedDefinition.getSystemKey());
        return savedDefinition;
    }

    public List<StatDefinition> getDefinitions(String userId) {
        return definitionRepository.findAllByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(this::isDailyStatDefinition)
                .toList();
    }

    @Transactional(readOnly = true)
    public StatBootstrapResponse getBootstrap(LocalDate from, LocalDate to, String userId) {
        validatePeriod(from, to);
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        List<StatDefinition> definitions = getDefinitions(userId);
        Set<String> definitionIds = definitions.stream()
                .map(StatDefinition::getId)
                .collect(Collectors.toSet());

        Map<String, List<StatEntry>> entriesByDefinition = entryRepository
                .findAllByUserIdAndDateBetween(userId, from, to).stream()
                .filter(entry -> entry.getStatDefinition() != null
                        && definitionIds.contains(entry.getStatDefinition().getId()))
                .collect(Collectors.groupingBy(
                        entry -> entry.getStatDefinition().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()));
        Map<String, StatSummaryResponse> summaries = new LinkedHashMap<>();
        for (StatDefinition definition : definitions) {
            List<StatEntry> entries = entriesByDefinition.getOrDefault(definition.getId(), List.of());
            entriesByDefinition.putIfAbsent(definition.getId(), entries);
            summaries.put(definition.getId(), summarize(definition, entries, from, to, user));
        }

        return new StatBootstrapResponse(from, to, definitions, entriesByDefinition, summaries);
    }

    @Transactional
    public List<StatDefinition> reorderDefinitions(List<String> definitionIds, String userId) {
        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId).stream()
                .filter(this::isDailyStatDefinition)
                .toList();
        Set<String> existingIds = definitions.stream()
                .map(StatDefinition::getId)
                .collect(Collectors.toSet());

        if (definitionIds == null || definitionIds.size() != definitions.size()
                || definitionIds.stream().anyMatch(id -> id == null)
                || definitionIds.stream().distinct().count() != definitionIds.size()
                || !existingIds.equals(Set.copyOf(definitionIds))) {
            throw new IllegalArgumentException("The reorder list must contain every stat exactly once.");
        }

        Map<String, StatDefinition> definitionsById = definitions.stream()
                .collect(Collectors.toMap(StatDefinition::getId, definition -> definition));
        for (int index = 0; index < definitionIds.size(); index++) {
            definitionsById.get(definitionIds.get(index)).setDisplayOrder(index);
        }
        definitionRepository.saveAll(definitions);
        log.info("Stat definitions reordered: userId={} count={} orderedDefinitionIds={}",
                userId, definitions.size(), definitionIds);
        return getDefinitions(userId);
    }

    public void deleteDefinition(String definitionId, String userId) {
        StatDefinition statDefinition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        if (statDefinition.getSystemKey() != null) {
            throw new IllegalArgumentException("Cannot delete a system stat.");
        }
        statGroupService.removeDefinitionFromGroups(definitionId, userId);
        definitionRepository.delete(statDefinition);
        log.info("Stat definition deleted: userId={} statDefinitionId={} name={}",
                userId, definitionId, statDefinition.getName());
    }

    public StatEntry recordEntry(String statDefinitionId, LocalDate date, double value, String userId) {
        return recordEntry(statDefinitionId, date, value, userId, false);
    }

    private StatEntry recordEntry(String statDefinitionId, LocalDate date, double value,
                                  String userId, boolean automatic) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat definition not found: " + statDefinitionId));

        if (!automatic && SystemStatCatalog.isAutomaticallyLoggedSystemKey(definition.getSystemKey())) {
            throw new IllegalArgumentException("Meditation stats are recorded automatically when a session ends.");
        }
        if (!isDailyStatDefinition(definition)) {
            throw new IllegalArgumentException("Mental state ratings must be recorded as a combined check-in.");
        }

        validateValue(definition, value);

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        Optional<StatEntry> existingEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinitionId,
                userId,
                date);
        Double previousValue = existingEntry.map(StatEntry::getValue).orElse(null);
        StatEntry statEntry = existingEntry.orElseGet(() -> createEntry(definition, date, user));
        statEntry.setValue(value);
        StatEntry savedEntry = entryRepository.save(statEntry);
        log.info("Stat value {}: userId={} statDefinitionId={} statName={} date={} value={} previousValue={}",
                previousValue == null ? "recorded" : "updated",
                userId, definition.getId(), definition.getName(), date, value, previousValue);
        return savedEntry;
    }

    @Transactional
    public void recordCompletedMeditation(LocalDate date, Duration duration, String userId) {
        if (duration == null || duration.isNegative()) {
            throw new IllegalArgumentException("Meditation duration cannot be null or negative.");
        }

        StatDefinition meditatedDefinition = getSystemDefinition(
                userId, SystemStatCatalog.MEDITATED_SYSTEM_KEY);
        StatDefinition minutesDefinition = getSystemDefinition(
                userId, SystemStatCatalog.MEDITATION_MINUTES_SYSTEM_KEY);

        recordEntry(meditatedDefinition.getId(), date, 1.0, userId, true);

        double existingMinutes = entryRepository
                .findByStatDefinitionIdAndUserIdAndDate(minutesDefinition.getId(), userId, date)
                .map(StatEntry::getValue)
                .orElse(0.0);
        double sessionMinutes = duration.toMillis() / 60_000.0;
        recordEntry(minutesDefinition.getId(), date, existingMinutes + sessionMinutes, userId, true);

        log.info("Meditation stats recorded: userId={} date={} sessionMinutes={} dailyMinutes={}",
                userId, date, sessionMinutes, existingMinutes + sessionMinutes);
    }

    public List<StatEntry> getEntries(String statDefinitionId, LocalDate from, LocalDate to, String userId) {
        definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat exists."));

        return entryRepository.findAllByStatDefinitionIdAndUserIdAndDateBetween(statDefinitionId,
                userId, from, to);
    }

    public List<StatEntry> getTodayEntries(String userId) {
        return entryRepository.findAllByUserIdAndDate(userId, LocalDate.now());
    }

    public List<StatEntry> getEntriesByDate(LocalDate date, String userId) {
        return entryRepository.findAllByUserIdAndDate(userId, date);
    }

    public StatSummaryResponse getSummary(String definitionId, LocalDate from, LocalDate to, String userId) {
        StatDefinition def = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such user."));
        validatePeriod(from, to);

        List<StatEntry> entries = entryRepository
                .findAllByStatDefinitionIdAndUserIdAndDateBetween(definitionId, userId, from, to);

        return summarize(def, entries, from, to, user);
    }

    private StatSummaryResponse summarize(StatDefinition def, List<StatEntry> entries,
                                          LocalDate from, LocalDate to, User user) {

        Map<LocalDate, Double> valueByDate = entries.stream()
                .collect(Collectors.toMap(StatEntry::getDate, StatEntry::getValue));

        int checkInStreak = computeStreak(to, from, valueByDate::containsKey);

        Integer periodYesCount = null;
        Integer booleanStreak = null;
        Integer longestBooleanStreak = null;
        Double periodAverage = null;
        Double periodTotal = null;
        Double periodHighest = null;

        if (def.getType() == StatType.BOOLEAN) {
            periodYesCount = (int) entries.stream()
                    .filter(entry -> entry.getValue() == 1.0)
                    .count();
            booleanStreak = computeStreak(to, from,
                    date -> valueByDate.containsKey(date) && valueByDate.get(date) == 1.0);
            longestBooleanStreak = computeLongestStreak(from, to,
                    date -> valueByDate.containsKey(date) && valueByDate.get(date) == 1.0);
        }

        if (def.getType() == StatType.NUMBER || def.getType() == StatType.RANGE
                || def.getType() == StatType.TIME || def.getType() == StatType.DURATION) {
            periodTotal = entries.stream()
                    .mapToDouble(StatEntry::getValue)
                    .sum();
            periodHighest = entries.stream()
                    .map(StatEntry::getValue)
                    .max(Double::compareTo)
                    .orElse(null);
            if (Boolean.TRUE.equals(user.getIncludeUnloggedNumericDaysAsZero())) {
                long periodDays = ChronoUnit.DAYS.between(from, to) + 1;
                periodAverage = periodTotal / periodDays;
            } else if (!entries.isEmpty()) {
                periodAverage = periodTotal / entries.size();
            }
        }

        return new StatSummaryResponse(checkInStreak, periodYesCount, booleanStreak, longestBooleanStreak,
                periodAverage, periodTotal, periodHighest);
    }

    private void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null || from.isAfter(to)) {
            throw new IllegalArgumentException("The summary period must have a valid start and end date.");
        }
    }

    /**
     * Counts consecutive days ending at {@code endDate} for which {@code hasEntry} is true.
     * If the end date itself has no entry, counts backwards from the previous day.
     */
    private int computeStreak(LocalDate endDate, LocalDate lowerBound, Predicate<LocalDate> hasEntry) {
        LocalDate start = hasEntry.test(endDate) ? endDate : endDate.minusDays(1);
        if (start.isBefore(lowerBound)) return 0;

        int streak = 0;
        LocalDate cursor = start;
        while (!cursor.isBefore(lowerBound) && hasEntry.test(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private int computeLongestStreak(LocalDate lowerBound, LocalDate upperBound,
                                     Predicate<LocalDate> hasEntry) {
        int longest = 0;
        int current = 0;
        LocalDate cursor = lowerBound;
        while (!cursor.isAfter(upperBound)) {
            if (hasEntry.test(cursor)) {
                current++;
                longest = Math.max(longest, current);
            } else {
                current = 0;
            }
            cursor = cursor.plusDays(1);
        }
        return longest;
    }

    private StatEntry createEntry(StatDefinition statDefinition, LocalDate date, User user) {
        return StatEntry.builder()
                .id(UUID.randomUUID().toString())
                .statDefinition(statDefinition)
                .date(date)
                .user(user)
                .build();
    }

    private StatDefinition getSystemDefinition(String userId, String systemKey) {
        return definitionRepository.findByUserIdAndSystemKey(userId, systemKey)
                .orElseThrow(() -> new IllegalStateException(
                        "Missing system stat definition: " + systemKey));
    }

    private int nextDisplayOrder(String userId) {
        return definitionRepository.findAllByUserId(userId).stream()
                .map(StatDefinition::getDisplayOrder)
                .filter(order -> order != null)
                .max(Integer::compareTo)
                .map(order -> order + 1)
                .orElse(0);
    }

    private boolean isDailyStatDefinition(StatDefinition definition) {
        return !SystemStatCatalog.isMentalStateSystemKey(definition.getSystemKey());
    }

    private void validateValue(StatDefinition statDefinition, Double value) {
        switch (statDefinition.getType()) {
            case StatType.BOOLEAN -> {
                if (!value.equals(0.0) && !value.equals(1.0)) {
                    throw new IllegalArgumentException("Invalid value for true/false stat: "
                    + statDefinition.getName());
                }
            }
            case StatType.RANGE -> {
                if (value > statDefinition.getMaxValue() || value < statDefinition.getMinValue()) {
                    throw new IllegalArgumentException("Value out of range for stat: "
                    + statDefinition.getName());
                }
            }
            case StatType.TIME -> {
                if (!Double.isFinite(value) || value < 0 || value >= 24 * 60 || value % 1 != 0) {
                    throw new IllegalArgumentException("Time values must be between 00:00 and 23:59: "
                            + statDefinition.getName());
                }
            }
            case StatType.DURATION -> {
                if (!Double.isFinite(value) || value < 0 || value % 1 != 0) {
                    throw new IllegalArgumentException("Duration values must be whole, non-negative minutes: "
                            + statDefinition.getName());
                }
            }
            case StatType.NUMBER -> {}
            default -> throw new IllegalStateException("Invalid stat type: " + statDefinition.getType());
        }
    }
}
