package org.osama.mentalstate;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MentalStateAdviceService {

    public MentalStateAssessment assess(int energy, int activation, int stimulationHunger,
                                        int clarity, int valence, int emotionalLoad) {
        DerivedScores scores = deriveScores(energy, activation, stimulationHunger,
                clarity, valence, emotionalLoad);

        return new MentalStateAssessment(
                state(energy, activation, clarity, emotionalLoad),
                suggestedActions(scores, energy, activation, clarity, emotionalLoad)
        );
    }

    private DerivedScores deriveScores(int energy, int activation, int stimulationHunger,
                                       int clarity, int valence, int emotionalLoad) {
        double productiveCapacity = energy * 0.4
                + clarity * 0.3
                + (10 - Math.abs(activation - 5)) * 0.15
                + (10 - stimulationHunger) * 0.075
                + valence * 0.075;

        double meaningfulEngagementPotential = energy * 0.25
                + clarity * 0.25
                + valence * 0.25
                + (10 - emotionalLoad) * 0.15
                + (10 - stimulationHunger) * 0.1;

        double dysregulationScore = Math.min(10,
                Math.abs(energy - activation) * 0.35
                        + Math.abs(activation - 5) * 0.35
                        + Math.max(0, 6 - clarity) * 0.55
                        + Math.max(0, emotionalLoad - 4) * 0.4
                        + Math.max(0, 5 - valence) * 0.55
                        + Math.max(0, stimulationHunger - 5) * 0.35);

        double compulsiveVulnerability = activation * 0.25
                + stimulationHunger * 0.45
                + (10 - clarity) * 0.15
                + (10 - energy) * 0.075
                + Math.max(0, 5 - valence) * 0.075;

        double moodRepairNeed = Math.max(0, 10 - valence) * 0.8
                + emotionalLoad * 0.2;

        double recoveryNeed = (10 - energy) * 0.4
                + emotionalLoad * 0.25
                + Math.abs(activation - 5) * 0.15
                + Math.max(0, 5 - valence) * 0.2;

        return new DerivedScores(
                productiveCapacity,
                meaningfulEngagementPotential,
                dysregulationScore,
                compulsiveVulnerability,
                moodRepairNeed,
                recoveryNeed
        );
    }

    private String state(int energy, int activation, int clarity, int emotionalLoad) {
        if (activation >= 7 && energy <= 4) return "Wired/Tired";
        if (energy <= 4 && activation <= 4) return "Depleted";
        if (energy >= 6 && activation <= 6 && clarity >= 6) return "Ready";
        if (activation >= 7 && clarity <= 5) return "Scattered/Overactivated";
        if (emotionalLoad >= 7) return "Emotionally Loaded";
        return "Mixed";
    }

    private List<String> suggestedActions(DerivedScores scores, int energy, int activation,
                                          int clarity, int emotionalLoad) {
        if (scores.moodRepairNeed() >= 5) {
            return List.of("EMOTIONAL REPAIR MODE: do not isolate in passive stimulation. Seek warmth, softness, or emotional grounding. Walk outside, message/call someone, comforting show/music, journal, café, shower, gentle game/book, low-pressure human contact.");
        }
        if (scores.dysregulationScore() >= 6 && scores.recoveryNeed() >= 6) {
            return List.of("WIRED/TIRED RESET: no stimulation chasing. Walk, shower, food/water, dim lights. Reassess soon.");
        }
        if (scores.compulsiveVulnerability() >= 7) {
            return List.of("DOPAMINE GUARDRAILS: phone away, no reels/vape/music spiral. Choose controlled stimulation: walk, gym, café, friend, book.");
        }
        if (scores.recoveryNeed() >= 7) {
            return List.of("TRUE RECOVERY: eat, hydrate, rest, sleep/nap, low sensory input.");
        }
        if (scores.productiveCapacity() >= 7) {
            return List.of("DEEP WORK WINDOW: do the important thing now.");
        }
        if (scores.productiveCapacity() >= 6
                && energy >= 4
                && clarity >= 5
                && activation <= 6
                && emotionalLoad <= 6) {
            return List.of("ALMOST READY: light boost first—coffee/tea, water, snack, sunlight, 5–10 min walk. Then start a 25-min work sprint.");
        }
        if (scores.meaningfulEngagementPotential() >= 5) {
            return List.of("HEALTHY STIMULATION: social, movement, fiction, creative work, focused game/show.");
        }
        return List.of("MAINTENANCE MODE: clean, shower, simple admin, prepare food, calm media.");
    }

    private record DerivedScores(
            double productiveCapacity,
            double meaningfulEngagementPotential,
            double dysregulationScore,
            double compulsiveVulnerability,
            double moodRepairNeed,
            double recoveryNeed
    ) {
    }
}
