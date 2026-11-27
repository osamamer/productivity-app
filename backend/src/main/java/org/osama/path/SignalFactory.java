package org.osama.path;

import lombok.RequiredArgsConstructor;
import org.osama.path.scoring.InputDirection;
import org.osama.path.scoring.SignalCombine;
import org.osama.path.scoring.StatFacts;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatDefinitionRepository;
import org.osama.stat.StatMorality;
import org.osama.stat.StatType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Validates signal requests into (unsaved) signals and describes signals for responses. */
@Component
@RequiredArgsConstructor
public class SignalFactory {
    static final int MAX_INPUTS = 8;

    private final StatDefinitionRepository definitionRepository;

    /** A new signal for {@code path}; nothing is saved. Throws IllegalArgumentException when invalid. */
    PathSignal build(SignalRequest request, Path path, String userId) {
        if (request == null || request.inputs() == null || request.inputs().isEmpty()) {
            throw new IllegalArgumentException("A path's signal needs at least one input.");
        }
        if (request.inputs().size() > MAX_INPUTS) {
            throw new IllegalArgumentException("A signal can have at most " + MAX_INPUTS + " inputs.");
        }
        PathSignal signal = new PathSignal();
        signal.setId(UUID.randomUUID().toString());
        signal.setPath(path);
        signal.setCombineMethod(request.combineMethod() == null ? SignalCombine.AVERAGE : request.combineMethod());
        List<PathSignalInput> inputs = new ArrayList<>();
        for (int index = 0; index < request.inputs().size(); index++) {
            PathSignalInput input = buildInput(request.inputs().get(index), userId);
            input.setSignal(signal);
            input.setDisplayOrder(index);
            inputs.add(input);
        }
        signal.setInputs(inputs);
        return signal;
    }

    SignalResponse describe(PathSignal signal, Map<String, StatDefinition> definitions) {
        return new SignalResponse(signal.getCombineMethod(), signal.getInputs().stream()
                .map(input -> SignalInputResponse.from(input, definitions.get(input.getStatDefinitionId())))
                .toList());
    }

    /** The user's stats behind these signals, by id; deleted stats are absent. */
    Map<String, StatDefinition> definitionsFor(Collection<PathSignal> signals, String userId) {
        List<String> ids = signals.stream()
                .flatMap(signal -> signal.getInputs().stream())
                .map(PathSignalInput::getStatDefinitionId)
                .distinct()
                .toList();
        return definitionRepository.findAllById(ids).stream()
                // The user relation, not the read-only user_id column, which is unset on stats created in this transaction.
                .filter(definition -> definition.getUser() != null && userId.equals(definition.getUser().getId()))
                .collect(Collectors.toMap(StatDefinition::getId, Function.identity()));
    }

    static StatType valueType(StatDefinition definition, String valueSource) {
        return PathSignalInput.MAIN_VALUE.equals(valueSource) ? definition.getType() : StatType.valueOf(valueSource);
    }

    static StatFacts facts(StatDefinition definition, String valueSource) {
        boolean mainValue = PathSignalInput.MAIN_VALUE.equals(valueSource);
        // The good threshold describes the main value; TIME thresholds wrap around midnight and are left out.
        Boolean minimum = !mainValue || definition.getType() == StatType.TIME ? null : switch (moralityOf(definition)) {
            case GOOD, NICE_TO_HAVE -> true;
            case BAD, NICE_TO_AVOID -> false;
            case NEUTRAL -> null;
        };
        return new StatFacts(definition.isIncludeUnloggedDaysAsZero(),
                minimum == null ? null : definition.getGoodThreshold(), minimum);
    }

    private PathSignalInput buildInput(SignalInputRequest request, String userId) {
        if (request == null || request.statDefinitionId() == null) {
            throw new IllegalArgumentException("Each input needs a stat.");
        }
        StatDefinition definition = definitionRepository.findByIdAndUserId(request.statDefinitionId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("Stat not found: " + request.statDefinitionId()));
        if (request.scoring() == null) throw new IllegalArgumentException("Each input needs a way to score weeks.");
        String source = validateSource(definition, request.valueSource());
        InputDirection direction = request.direction() != null ? request.direction() : defaultDirection(definition);
        PathSignalInput input = new PathSignalInput();
        input.setId(UUID.randomUUID().toString());
        input.setStatDefinitionId(definition.getId());
        input.setValueSource(source);
        input.setDirection(direction);
        input.setScoring(request.scoring());
        input.setPeriod(request.scoring().period());
        input.setTarget(validateTarget(request.target(), direction));
        input.setWeight(validateWeight(request.weight()));
        return input;
    }

    private static String validateSource(StatDefinition definition, String requested) {
        if (requested == null || requested.isBlank() || PathSignalInput.MAIN_VALUE.equals(requested)) {
            return PathSignalInput.MAIN_VALUE;
        }
        boolean offered = definition.getAdditionalInputTypes().stream().anyMatch(type -> type.name().equals(requested));
        if (!offered) throw new IllegalArgumentException("That stat has no " + requested + " input.");
        return requested;
    }

    private static double validateTarget(Double target, InputDirection direction) {
        if (target == null || !Double.isFinite(target) || target < 0) {
            throw new IllegalArgumentException("Each input needs a target of zero or more.");
        }
        if (direction == InputDirection.MORE_IS_BETTER && target == 0) {
            throw new IllegalArgumentException("A more-is-better target must be above zero.");
        }
        return target;
    }

    private static double validateWeight(Double weight) {
        if (weight == null) return 1;
        if (!Double.isFinite(weight) || weight <= 0) throw new IllegalArgumentException("Weights must be above zero.");
        return weight;
    }

    private static InputDirection defaultDirection(StatDefinition definition) {
        return switch (moralityOf(definition)) {
            case BAD, NICE_TO_AVOID -> InputDirection.LESS_IS_BETTER;
            case GOOD, NICE_TO_HAVE, NEUTRAL -> InputDirection.MORE_IS_BETTER;
        };
    }

    private static StatMorality moralityOf(StatDefinition definition) {
        return definition.getMorality() == null ? StatMorality.NEUTRAL : definition.getMorality();
    }
}
