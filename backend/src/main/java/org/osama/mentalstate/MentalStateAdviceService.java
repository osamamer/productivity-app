package org.osama.mentalstate;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MentalStateAdviceService {

    public MentalStateAssessment assess(int energy, int activation, int stimulationHunger,
                                        int clarity, int valence, int emotionalLoad,
                                        MentalStateGoal goal) {
        MentalState state = classify(energy, activation, stimulationHunger,
                clarity, valence, emotionalLoad);

        return new MentalStateAssessment(
                state.label,
                List.of(state.recommendationFor(goal))
        );
    }

    private MentalState classify(int energy, int activation, int stimulationHunger,
                                 int clarity, int valence, int emotionalLoad) {
        if (activation >= 7 && energy <= 4) return MentalState.WIRED_TIRED;
        if (energy <= 4 && activation <= 4) return MentalState.DEPLETED;
        if (stimulationHunger >= 8) return MentalState.STIMULATION_SEEKING;
        if (activation >= 7 && clarity <= 5) return MentalState.SCATTERED;
        if (emotionalLoad >= 7) return MentalState.EMOTIONALLY_LOADED;
        if (valence <= 2) return MentalState.LOW_MOOD;
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
                && valence >= 4
                && emotionalLoad <= 4;
    }

    private boolean isAlmostReady(int energy, int activation, int stimulationHunger,
                                  int clarity, int valence, int emotionalLoad) {
        return energy >= 5
                && activation >= 3 && activation <= 7
                && stimulationHunger <= 6
                && clarity >= 5
                && valence >= 4
                && emotionalLoad <= 6;
    }

    private enum MentalState {
        WIRED_TIRED(
                "Wired/Tired",
                "Your body may be tired while your system is still switched on. Step away from stimulating content, then try some water or food, a short walk, a shower, and dimmer lights. Check in again when you feel steadier.",
                "Choose something pleasant and low-pressure, like a familiar show, quiet hobby, or easy company. Pause anything that is winding you up.",
                "Reduce stimulation and obligations. Get water or food, dim the lights, and rest while your system settles."),
        DEPLETED(
                "Depleted",
                "Give yourself permission to recover before asking yourself to do more. Eat something, drink some water, and rest in a quiet, low-sensory space.",
                "Let leisure be restful: listen to familiar music, watch a show, sit outside, or spend time with someone. No need to make it productive.",
                "Prioritize basic needs and rest. Postpone optional demands where you can."),
        STIMULATION_SEEKING(
                "Stimulation-Seeking",
                "Make it harder to fall into a stimulation spiral for a while. Put your phone away and choose one contained activity, such as a walk, the gym, a café, a book, or time with a friend.",
                "Pick something engaging on purpose, such as music, a game, sport, a creative activity, or seeing someone. Set a stopping point.",
                "Choose one activity, such as listening to audio, watching a familiar show, or taking a walk. Avoid switching between feeds."),
        SCATTERED(
                "Scattered/Overactivated",
                "Your system may be running fast while clarity is low. Reduce stimulation, write down the next small step, and give yourself a short quiet block to settle.",
                "Pick one absorbing, playful activity and do it without multitasking.",
                "Turn down noise and notifications. Sit or lie somewhere quiet."),
        EMOTIONALLY_LOADED(
                "Emotionally Loaded",
                "If you feel overloaded, talk to someone you trust or take a break before demanding work.",
                "Choose comforting company or a familiar activity, with room to change your mind or leave.",
                "Reduce demands. Tend to basic needs, and consider writing or talking with someone you trust if that feels helpful."),
        LOW_MOOD(
                "Low Mood",
                "Choose a walk, shower, music, journaling, or an easy show before returning to work.",
                "Listen to favorite music, watch a familiar show, go outside, or contact a friend.",
                "Rest and tend to basic needs. Go outside if you feel up to it."),
        READY(
                "Ready",
                "You have a good window for focused work. Choose the most important thing and give it your full attention for a while.",
                "Choose leisure you will enjoy, and spend time doing it without feeling you should be doing something else.",
                "Use this steadier moment for rest, time outside, or a quiet activity. You do not have to turn available energy into work."),
        ALMOST_READY(
                "Almost Ready",
                "You may just need a small boost before getting started. Try some water, tea or coffee, a snack, sunlight, or a short walk, then begin with a 25-minute work sprint.",
                "Choose an activity and start with one simple step, such as putting on music or getting what you need. No target required.",
                "Get water or food if needed, then rest somewhere comfortable."),
        ENGAGED(
                "Engaged",
                "Choose something engaging that leaves you feeling better afterward. Social time, movement, fiction, creative work, or a focused game or show could all fit.",
                "Choose an activity that feels absorbing and enjoyable, such as creating, moving, playing, or spending time with someone.",
                "Choose a familiar activity that takes little effort, and stop when you need a break."),
        MIXED(
                "Mixed",
                "Keep things simple for now. Take care of one small practical task, such as tidying up, showering, making food, or handling an easy bit of admin, then settle into something calm.",
                "Choose a familiar, low-decision activity that sounds pleasant enough to start.",
                "Check for one immediate need, such as food, water, the bathroom, or rest. Address one need first.");

        private final String label;
        private final String laborRecommendation;
        private final String leisureRecommendation;
        private final String recoveryRecommendation;

        MentalState(String label, String laborRecommendation,
                    String leisureRecommendation, String recoveryRecommendation) {
            this.label = label;
            this.laborRecommendation = laborRecommendation;
            this.leisureRecommendation = leisureRecommendation;
            this.recoveryRecommendation = recoveryRecommendation;
        }

        String recommendationFor(MentalStateGoal goal) {
            return switch (goal) {
                case LABOR -> laborRecommendation;
                case LEISURE -> leisureRecommendation;
                case RECOVERY -> recoveryRecommendation;
            };
        }
    }
}
