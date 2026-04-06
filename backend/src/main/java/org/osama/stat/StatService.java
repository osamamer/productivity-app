package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
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

        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("A stat must have a name.");
        }
        if (type.equals(StatType.RANGE)) {
            if (minValue == null || maxValue == null || minValue.isNaN()
                    || maxValue.isNaN() || minValue > maxValue) {
                throw new IllegalArgumentException("Invalid range for stat.");
            }
        }

        StatDefinition definition = new StatDefinition();
        definition.setId(UUID.randomUUID().toString());
        definition.setName(name);
        definition.setDescription(description);
        definition.setType(type);
        definition.setMinValue(minValue);
        definition.setMaxValue(maxValue);
        definition.setUser(user);
        return definitionRepository.save(definition);
    }

    public List<StatDefinition> getDefinitions(String userId) {
        return definitionRepository.findAllByUserId(userId);
    }

    public void deleteDefinition(String definitionId, String userId) {
        StatDefinition statDefinition = definitionRepository.findByIdAndUserId(definitionId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No such stat."));
        definitionRepository.delete(statDefinition);
    }

    public StatEntry recordEntry(String statDefinitionId, LocalDate date, double value, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat definition not found: " + statDefinitionId));

        validateValue(definition, value);

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        StatEntry statEntry = entryRepository.findByStatDefinitionIdAndUserIdAndDate(statDefinitionId,
                userId,
                date)
                .orElse(createEntry(definition, date, user));
        statEntry.setValue(value);
        entryRepository.save(statEntry);
        return statEntry;
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
