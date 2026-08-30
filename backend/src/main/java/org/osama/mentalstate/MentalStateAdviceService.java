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
                state(scores, energy, activation, clarity, valence, emotionalLoad),
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

    private String state(DerivedScores scores, int energy, int activation, int clarity,
                         int valence, int emotionalLoad) {
        if (activation >= 7 && energy <= 4) return "Wired/Tired";
        if (energy <= 4 && activation <= 4) return "Depleted";
        if (energy >= 6 && activation <= 6 && clarity >= 6
                && valence >= 5 && emotionalLoad <= 6) return "Ready";
        if (activation >= 7 && clarity <= 5) return "Scattered/Overactivated";
        if (emotionalLoad >= 7) return "Emotionally Loaded";
        if (valence <= 4) return "Low Mood";
        if (scores.compulsiveVulnerability() >= 7) return "Stimulation-Seeking";
        if (scores.productiveCapacity() >= 7) return "Ready";
        if (scores.productiveCapacity() >= 6
                && energy >= 4
                && clarity >= 5
                && activation <= 6
                && emotionalLoad <= 6) {
            return "Almost Ready";
        }
        if (scores.meaningfulEngagementPotential() >= 5
                && valence >= 7
                && emotionalLoad <= 5) return "Engaged";
        return "Mixed";
    }

    private List<String> suggestedActions(DerivedScores scores, int energy, int activation,
                                          int clarity, int emotionalLoad) {
        if (scores.moodRepairNeed() >= 5) {
            return List.of("Focus on feeling grounded before trying to be productive. Reach out to someone or choose something gentle and comforting, like a walk, a shower, music, journaling, or a low-pressure show.");
        }
        if (scores.dysregulationScore() >= 6 && scores.recoveryNeed() >= 6) {
            return List.of("Your body may be tired while your system is still switched on. Step away from stimulating content, then try some water or food, a short walk, a shower, and dimmer lights. Check in again when you feel steadier.");
        }
        if (scores.compulsiveVulnerability() >= 7) {
            return List.of("Make it harder to fall into a stimulation spiral for a while. Put your phone away and choose one contained activity, such as a walk, the gym, a café, a book, or time with a friend.");
        }
        if (scores.recoveryNeed() >= 7) {
            return List.of("Give yourself permission to recover before asking yourself to do more. Eat something, drink some water, and rest in a quiet, low-sensory space.");
        }
        if (scores.productiveCapacity() >= 7) {
            return List.of("You have a good window for focused work. Choose the most important thing and give it your full attention for a while.");
        }
        if (scores.productiveCapacity() >= 6
                && energy >= 4
                && clarity >= 5
                && activation <= 6
                && emotionalLoad <= 6) {
            return List.of("You may just need a small boost before getting started. Try some water, tea or coffee, a snack, sunlight, or a short walk, then begin with a 25-minute work sprint.");
        }
        if (scores.meaningfulEngagementPotential() >= 5) {
            return List.of("Choose something engaging that leaves you feeling better afterward. Social time, movement, fiction, creative work, or a focused game or show could all fit.");
        }
        return List.of("Keep things simple for now. Take care of one small practical task, such as tidying up, showering, making food, or handling an easy bit of admin, then settle into something calm.");
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
