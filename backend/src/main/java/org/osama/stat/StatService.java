package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
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

    public StatService(StatDefinitionRepository definitionRepository,
                       StatEntryRepository entryRepository,
                       UserRepository userRepository) {
        this.definitionRepository = definitionRepository;
        this.entryRepository = entryRepository;
        this.userRepository = userRepository;
    }

    public StatDefinition createDefinition(String name, String description, StatType type,
                                           Double minValue, Double maxValue, String userId) {
        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        validateDefinition(name, type, minValue, maxValue, userId);
        return saveDefinition(name, description, type, minValue, maxValue, null, user);
    }

    StatDefinition createSystemDefinition(SystemStatDefinition systemStat, User user) {
        validateDefinition(systemStat.name(), systemStat.type(), systemStat.minValue(),
                systemStat.maxValue(), user.getId());
        return saveDefinition(systemStat.name(), systemStat.description(), systemStat.type(),
                systemStat.minValue(), systemStat.maxValue(), systemStat.systemKey(), user);
    }

    private void validateDefinition(String name, StatType type, Double minValue,
                                    Double maxValue, String userId) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A stat must have a name.");
        }
        if (type == null) {
            throw new IllegalArgumentException("A stat must have a type.");
        }
        if (definitionRepository.findByUserIdAndNameIgnoreCase(userId, name).isPresent()) {
            throw new IllegalArgumentException("A stat with that name already exists.");
        }
        if (type == StatType.RANGE) {
            if (minValue == null || maxValue == null || minValue.isNaN()
                    || maxValue.isNaN() || minValue > maxValue) {
                throw new IllegalArgumentException("Invalid range for stat.");
            }
        }
    }

    private StatDefinition saveDefinition(String name, String description, StatType type,
                                          Double minValue, Double maxValue, String systemKey,
                                          User user) {
        StatDefinition definition = new StatDefinition();
        definition.setId(UUID.randomUUID().toString());
        definition.setName(name);
        definition.setDescription(description);
        definition.setType(type);
        definition.setMinValue(minValue);
        definition.setMaxValue(maxValue);
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
        return definitionRepository.findAllByUserIdOrderByDisplayOrderAsc(userId);
    }

    @Transactional
    public List<StatDefinition> reorderDefinitions(List<String> definitionIds, String userId) {
        List<StatDefinition> definitions = definitionRepository.findAllByUserId(userId);
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
        definitionRepository.delete(statDefinition);
        log.info("Stat definition deleted: userId={} statDefinitionId={} name={}",
                userId, definitionId, statDefinition.getName());
    }

    public StatEntry recordEntry(String statDefinitionId, LocalDate date, double value, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat definition not found: " + statDefinitionId));

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

    public StatSummaryResponse getSummary(String definitionId, String userId) {
        StatDefinition def = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));

        LocalDate today = LocalDate.now();
        LocalDate yearAgo = today.minusDays(364);
        LocalDate startOfMonth = today.withDayOfMonth(1);

        List<StatEntry> entries = entryRepository
                .findAllByStatDefinitionIdAndUserIdAndDateBetween(definitionId, userId, yearAgo, today);

        Map<LocalDate, Double> valueByDate = entries.stream()
                .collect(Collectors.toMap(StatEntry::getDate, StatEntry::getValue));

        int checkInStreak = computeStreak(today, valueByDate::containsKey);

        Integer monthlyCheckIns = null;
        Integer booleanStreak = null;
        Double monthlyAverage = null;

        if (def.getType() == StatType.BOOLEAN) {
            monthlyCheckIns = (int) entries.stream()
                    .filter(e -> !e.getDate().isBefore(startOfMonth))
                    .count();
            booleanStreak = computeStreak(today,
                    date -> valueByDate.containsKey(date) && valueByDate.get(date) == 1.0);
        }

        if (def.getType() == StatType.NUMBER || def.getType() == StatType.RANGE) {
            OptionalDouble avg = entries.stream()
                    .filter(e -> !e.getDate().isBefore(startOfMonth))
                    .mapToDouble(StatEntry::getValue)
                    .average();
            monthlyAverage = avg.isPresent() ? avg.getAsDouble() : null;
        }

        return new StatSummaryResponse(checkInStreak, monthlyCheckIns, booleanStreak, monthlyAverage);
    }

    /**
     * Counts consecutive days ending at {@code today} for which {@code hasEntry} is true.
     * If today itself has no entry, counts backwards from yesterday — the day isn't over yet.
     */
    private int computeStreak(LocalDate today, Predicate<LocalDate> hasEntry) {
        LocalDate start = hasEntry.test(today) ? today : today.minusDays(1);
        int streak = 0;
        LocalDate cursor = start;
        // Safety cap at 365 days (matches the data we fetched)
        while (streak <= 365 && hasEntry.test(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private StatEntry createEntry(StatDefinition statDefinition, LocalDate date, User user) {
        return StatEntry.builder()
                .id(UUID.randomUUID().toString())
                .statDefinition(statDefinition)
                .date(date)
                .user(user)
                .build();
    }

    private int nextDisplayOrder(String userId) {
        return definitionRepository.findAllByUserId(userId).stream()
                .map(StatDefinition::getDisplayOrder)
                .filter(order -> order != null)
                .max(Integer::compareTo)
                .map(order -> order + 1)
                .orElse(0);
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
            case StatType.NUMBER -> {}
            default -> throw new IllegalStateException("Invalid stat type: " + statDefinition.getType());
        }
    }
}
