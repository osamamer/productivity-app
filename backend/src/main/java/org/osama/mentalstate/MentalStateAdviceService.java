package org.osama.mentalstate;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MentalStateAdviceService {

    public MentalStateAssessment assess(int energy, int activation, int stimulationHunger,
                                        int clarity, int valence, int emotionalLoad) {
        MentalState state = classify(energy, activation, stimulationHunger,
                clarity, valence, emotionalLoad);

        return new MentalStateAssessment(
                state.label,
                List.of(state.recommendation)
        );
    }

    private MentalState classify(int energy, int activation, int stimulationHunger,
                                 int clarity, int valence, int emotionalLoad) {
        if (activation >= 7 && energy <= 4) return MentalState.WIRED_TIRED;
        if (energy <= 4 && activation <= 4) return MentalState.DEPLETED;
        if (stimulationHunger >= 8) return MentalState.STIMULATION_SEEKING;
        if (activation >= 7 && clarity <= 5) return MentalState.SCATTERED;
        if (emotionalLoad >= 7) return MentalState.EMOTIONALLY_LOADED;
        if (valence <= 4) return MentalState.LOW_MOOD;
        if (isReady(energy, activation, stimulationHunger, clarity, valence, emotionalLoad)) {
            return MentalState.READY;
        }
        if (isAlmostReady(energy, activation, stimulationHunger, clarity, valence, emotionalLoad)) {
            return MentalState.ALMOST_READY;
        }
        if (energy >= 4 && clarity >= 5 && valence >= 7 && emotionalLoad <= 5) {
            return MentalState.ENGAGED;
        }
        return MentalState.MIXED;
    }

    private boolean isReady(int energy, int activation, int stimulationHunger,
                            int clarity, int valence, int emotionalLoad) {
        return energy >= 6
                && activation >= 4 && activation <= 8
                && stimulationHunger <= 5
                && clarity >= 6
                && valence >= 6
                && emotionalLoad <= 4;
    }

    private boolean isAlmostReady(int energy, int activation, int stimulationHunger,
                                  int clarity, int valence, int emotionalLoad) {
        return energy >= 6
                && activation >= 4 && activation <= 7
                && stimulationHunger <= 6
                && clarity >= 6
                && valence >= 5
                && emotionalLoad <= 6;
    }

    private enum MentalState {
        WIRED_TIRED(
                "Wired/Tired",
                "Your body may be tired while your system is still switched on. Step away from stimulating content, then try some water or food, a short walk, a shower, and dimmer lights. Check in again when you feel steadier."),
        DEPLETED(
                "Depleted",
                "Give yourself permission to recover before asking yourself to do more. Eat something, drink some water, and rest in a quiet, low-sensory space."),
        STIMULATION_SEEKING(
                "Stimulation-Seeking",
                "Make it harder to fall into a stimulation spiral for a while. Put your phone away and choose one contained activity, such as a walk, the gym, a café, a book, or time with a friend."),
        SCATTERED(
                "Scattered/Overactivated",
                "Your system may be running fast while clarity is low. Reduce stimulation, write down the next small step, and give yourself a short quiet block to settle."),
        EMOTIONALLY_LOADED(
                "Emotionally Loaded",
                "There is a lot of emotional weight here. Reach out to someone safe or choose a gentle, grounding activity before taking on demanding work."),
        LOW_MOOD(
                "Low Mood",
                "Be gentle with yourself for now. Choose warmth or connection—a walk, a shower, music, journaling, or a low-pressure show—before pushing for productivity."),
        READY(
                "Ready",
                "You have a good window for focused work. Choose the most important thing and give it your full attention for a while."),
        ALMOST_READY(
                "Almost Ready",
                "You may just need a small boost before getting started. Try some water, tea or coffee, a snack, sunlight, or a short walk, then begin with a 25-minute work sprint."),
        ENGAGED(
                "Engaged",
                "Choose something engaging that leaves you feeling better afterward. Social time, movement, fiction, creative work, or a focused game or show could all fit."),
        MIXED(
                "Mixed",
                "Keep things simple for now. Take care of one small practical task, such as tidying up, showering, making food, or handling an easy bit of admin, then settle into something calm.");

        private final String label;
        private final String recommendation;

        MentalState(String label, String recommendation) {
            this.label = label;
            this.recommendation = recommendation;
        }
    }
}
