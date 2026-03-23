package org.osama.stat;

import lombok.extern.slf4j.Slf4j;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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

        // TODO: Validate the inputs before persisting.
        //   - name must not be blank — what should the user see if they send an empty name?
        //   - For RANGE type, both minValue and maxValue must be present and minValue < maxValue.
        //     What happens if someone passes a RANGE stat with no min/max? Should it fail fast here,
        //     or is it safer to also guard this in the controller? Think about where validation belongs.
        //   - For NUMBER and BOOLEAN, minValue and maxValue should be ignored (or rejected — pick one).

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
        // TODO: Fetch the definition by (id, userId) — why should you scope the lookup by userId?
        //   What attack is prevented if you check ownership before deleting?
        //   Once you've confirmed ownership, delete it. What happens to all existing StatEntry rows
        //   that reference this definition? Look at what ON DELETE CASCADE means in the migration
        //   you'll write and decide if that's the right behaviour here.
        throw new UnsupportedOperationException("TODO: implement deleteDefinition");
    }

    public StatEntry recordEntry(String statDefinitionId, LocalDate date, double value, String userId) {
        StatDefinition definition = definitionRepository.findByIdAndUserId(statDefinitionId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat definition not found: " + statDefinitionId));

        // TODO: Validate `value` against the definition's type.
        //   - BOOLEAN: value must be exactly 0.0 or 1.0. What should happen if someone sends 0.5?
        //   - RANGE: value must be >= minValue and <= maxValue. Should you clamp silently (like
        //     DayService does for ratings) or throw? Consider which is better UX and which is safer.
        //   - NUMBER: any double is valid — no validation needed.
        //   Hint: a small private validateValue(StatDefinition, double) method keeps this readable.

        User user = userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId));

        // TODO: Implement upsert — one entry per (stat, user, date).
        //   Look at how DayService handles this pattern: it calls findBy...orElse(createNew...).
        //   Do the same here: check if an entry already exists for this (statDefinitionId, userId, date).
        //   If yes, update its value. If no, create a new one.
        //   The unique constraint in the DB is your safety net, but don't rely on a constraint
        //   violation as your primary control flow — catch the case explicitly in code first.
        throw new UnsupportedOperationException("TODO: implement recordEntry");
    }

    public List<StatEntry> getEntries(String statDefinitionId, LocalDate from, LocalDate to, String userId) {
        // TODO: Before querying entries, verify the definition exists and belongs to this user.
        //   Why? If you skip ownership check and just query entries, what can go wrong?
        //   (Think: can user A request entries for user B's stat definition id?)
        throw new UnsupportedOperationException("TODO: implement getEntries");
    }

    public List<StatEntry> getTodayEntries(String userId) {
        return entryRepository.findAllByUserIdAndDate(userId, LocalDate.now());
    }
}
