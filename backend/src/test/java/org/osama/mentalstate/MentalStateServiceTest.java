package org.osama.mentalstate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
@Import({MentalStateService.class, MentalStateAdviceService.class})
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {
                DependencyInjectionTestExecutionListener.class,
                TransactionalTestExecutionListener.class
        },
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class MentalStateServiceTest {

    private static final String USER_ID = "mental-state-user";

    @Autowired private MentalStateService mentalStateService;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .email("mental-state@example.com")
                .firstName("Mental")
                .lastName("State")
                .username("mental-state")
                .active(true)
                .build());
    }

    @Test
    void recordsMultipleCombinedCheckInsWithoutCollapsingThemByDay() {
        MentalStateCheckInResponse first = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(4, 5, 3, 6, 6, 4), USER_ID);
        MentalStateCheckInResponse second = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(8, 9, 7, 3, 3, 8), USER_ID);

        List<MentalStateCheckInResponse> history = mentalStateService.getHistory(USER_ID, 30);

        assertEquals(2, history.size());
        assertTrue(history.stream().anyMatch(checkIn -> checkIn.id().equals(first.id())));
        assertTrue(history.stream().anyMatch(checkIn -> checkIn.id().equals(second.id())));
        assertTrue(history.stream().allMatch(checkIn -> checkIn.recordedAt() != null));
    }

    @Test
    void returnsOnlyTheStateAndSuggestedActions() {
        MentalStateCheckInResponse response = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(3, 8, 8, 4, 2, 8), USER_ID);

        assertEquals("Wired/Tired", response.state());
        assertEquals(1, response.suggestedActions().size());
        assertTrue(response.suggestedActions().get(0).startsWith("EMOTIONAL REPAIR MODE:"));
    }

    @Test
    void classifiesStatesInTheRequestedOrder() {
        assertEquals("Wired/Tired", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(4, 7, 5, 6, 6, 4), USER_ID).state());
        assertEquals("Depleted", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(4, 4, 5, 6, 6, 4), USER_ID).state());
        assertEquals("Ready", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(6, 6, 5, 6, 6, 4), USER_ID).state());
        assertEquals("Scattered/Overactivated", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(5, 7, 5, 5, 6, 4), USER_ID).state());
        assertEquals("Emotionally Loaded", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(5, 5, 5, 5, 6, 7), USER_ID).state());
        assertEquals("Mixed", mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(5, 5, 5, 5, 6, 6), USER_ID).state());
    }

    @Test
    void usesTheRequestedDerivedScorePriorityForSuggestedActions() {
        MentalStateCheckInResponse wiredTiredReset = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(1, 10, 10, 1, 8, 7), USER_ID);
        MentalStateCheckInResponse dopamineGuardrails = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(8, 10, 10, 1, 8, 1), USER_ID);
        MentalStateCheckInResponse deepWork = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(10, 5, 1, 10, 10, 1), USER_ID);
        MentalStateCheckInResponse almostReady = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(6, 5, 5, 6, 5, 4), USER_ID);
        MentalStateCheckInResponse healthyStimulation = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(4, 5, 1, 5, 8, 1), USER_ID);
        MentalStateCheckInResponse maintenance = mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(1, 5, 1, 1, 8, 1), USER_ID);

        assertTrue(wiredTiredReset.suggestedActions().get(0).startsWith("WIRED/TIRED RESET:"));
        assertTrue(dopamineGuardrails.suggestedActions().get(0).startsWith("DOPAMINE GUARDRAILS:"));
        assertTrue(deepWork.suggestedActions().get(0).startsWith("DEEP WORK WINDOW:"));
        assertTrue(almostReady.suggestedActions().get(0).startsWith("ALMOST READY:"));
        assertTrue(healthyStimulation.suggestedActions().get(0).startsWith("HEALTHY STIMULATION:"));
        assertTrue(maintenance.suggestedActions().get(0).startsWith("MAINTENANCE MODE:"));
    }

    @Test
    void rejectsAnyRatingOutsideTheOneToTenScale() {
        assertThrows(IllegalArgumentException.class, () -> mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(0, 5, 5, 5, 5, 5), USER_ID));
        assertThrows(IllegalArgumentException.class, () -> mentalStateService.checkIn(
                new CreateMentalStateCheckInRequest(5, 5, 5, 11, 5, 5), USER_ID));
    }

    @Test
    void historyIsScopedToTheCurrentUser() {
        User other = userRepository.save(User.builder()
                .id("other-mental-state-user")
                .email("other-mental-state@example.com")
                .firstName("Other")
                .lastName("User")
                .username("other-mental-state")
                .active(true)
                .build());
        mentalStateService.checkIn(new CreateMentalStateCheckInRequest(3, 3, 3, 3, 3, 3), other.getId());

        assertTrue(mentalStateService.getHistory(USER_ID, 30).isEmpty());
    }
}
