package org.osama.mentalthread;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
@Import(MentalThreadService.class)
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = {
                DependencyInjectionTestExecutionListener.class,
                TransactionalTestExecutionListener.class
        },
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class MentalThreadServiceTest {
    private static final String USER_ID = "mental-thread-user";

    @Autowired
    private MentalThreadService mentalThreadService;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.save(User.builder()
                .id(USER_ID)
                .email("threads@example.com")
                .firstName("Thread")
                .lastName("Tester")
                .username("thread-tester")
                .active(true)
                .build());
    }

    @Test
    void creatingAThreadRecordsItsInitialLoadAndKeepsRuminationDistinctFromAction() {
        MentalThreadResponse created = mentalThreadService.createThread(
                createRequest("Decide whether to move", AttentionState.RUMINATING, 8),
                USER_ID
        );

        List<MentalThreadLoadEntryResponse> history = mentalThreadService.getLoadHistory(created.id(), USER_ID);

        assertEquals(MentalThreadStatus.OPEN, created.status());
        assertEquals(AttentionState.RUMINATING, created.attentionState());
        assertEquals(8, created.currentMentalLoad());
        assertEquals(1, history.size());
        assertEquals(8, history.getFirst().load());
    }

    @Test
    void updatingTheLoadAddsHistoryButAnUnchangedLoadDoesNot() {
        MentalThreadResponse created = mentalThreadService.createThread(
                createRequest("Wait for an answer", AttentionState.PENDING, 6),
                USER_ID
        );

        mentalThreadService.updateThread(
                created.id(),
                updateRequest(created, AttentionState.PENDING, 6, null),
                USER_ID
        );
        mentalThreadService.updateThread(
                created.id(),
                updateRequest(created, AttentionState.ACTING, 4, "I can act on it now"),
                USER_ID
        );

        List<MentalThreadLoadEntryResponse> history = mentalThreadService.getLoadHistory(created.id(), USER_ID);
        assertEquals(2, history.size());
        assertEquals(4, history.getLast().load());
        assertEquals("I can act on it now", history.getLast().reason());
    }

    @Test
    void summaryCountsOnlyOpenThreadsAndReportsCapacitySeparately() {
        mentalThreadService.createThread(createRequest("Act on this", AttentionState.ACTING, 9), USER_ID);
        mentalThreadService.createThread(createRequest("Keep circling this", AttentionState.RUMINATING, 7), USER_ID);
        MentalThreadResponse pending = mentalThreadService.createThread(
                createRequest("Wait for this", AttentionState.PENDING, 4), USER_ID);
        mentalThreadService.closeThread(
                pending.id(),
                new CloseMentalThreadRequest(ClosureType.ACCEPTED, "No longer needs monitoring"),
                USER_ID
        );
        mentalThreadService.checkInCapacity(3, USER_ID);

        MentalThreadSummaryResponse summary = mentalThreadService.getSummary(USER_ID);

        assertEquals(2, summary.openThreadCount());
        assertEquals(16, summary.totalLoad());
        assertEquals(2, summary.highLoadCount());
        assertEquals(1, summary.actingCount());
        assertEquals(1, summary.ruminatingCount());
        assertEquals(0, summary.pendingCount());
        assertEquals(3, summary.capacityToday());
    }

    @Test
    void closingAndReopeningPreservesLoadWhileClearingTheOldResolution() {
        MentalThreadResponse created = mentalThreadService.createThread(
                createRequest("Repair a relationship", AttentionState.PLANNED, 7),
                USER_ID
        );

        MentalThreadResponse closed = mentalThreadService.closeThread(
                created.id(),
                new CloseMentalThreadRequest(ClosureType.RESOLVED, "We talked and agreed on a boundary"),
                USER_ID
        );
        MentalThreadResponse reopened = mentalThreadService.reopenThread(created.id(), USER_ID);

        assertEquals(MentalThreadStatus.CLOSED, closed.status());
        assertEquals(ClosureType.RESOLVED, closed.closureType());
        assertEquals(7, reopened.currentMentalLoad());
        assertEquals(MentalThreadStatus.OPEN, reopened.status());
        assertNull(reopened.closureType());
        assertNull(reopened.resolutionSummary());
    }

    @Test
    void aThreadCannotBeReadThroughAnotherUsersIdentity() {
        MentalThreadResponse created = mentalThreadService.createThread(
                createRequest("Private concern", AttentionState.RUMINATING, 5),
                USER_ID
        );

        assertThrows(ResourceNotFoundException.class,
                () -> mentalThreadService.getThread(created.id(), "someone-else"));
    }

    @Test
    void loadAndCapacityRatingsMustStayOnTheOneToTenScale() {
        assertThrows(IllegalArgumentException.class,
                () -> mentalThreadService.createThread(
                        createRequest("Impossible load", AttentionState.ACTING, 11), USER_ID));
        assertThrows(IllegalArgumentException.class,
                () -> mentalThreadService.checkInCapacity(0, USER_ID));
    }

    @Test
    void deletingAThreadAlsoDeletesItsLoadHistory() {
        MentalThreadResponse created = mentalThreadService.createThread(
                createRequest("Temporary concern", AttentionState.PLANNED, 3),
                USER_ID
        );

        mentalThreadService.deleteThread(created.id(), USER_ID);

        assertTrue(mentalThreadService.getThreads(USER_ID, true).isEmpty());
    }

    private CreateMentalThreadRequest createRequest(String title, AttentionState attentionState, int load) {
        return new CreateMentalThreadRequest(
                title,
                "Something that is occupying attention",
                attentionState,
                "Know what comes next",
                LocalDate.now().plusWeeks(2),
                null,
                LocalDate.now().plusDays(2),
                load,
                "Initial check-in"
        );
    }

    private UpdateMentalThreadRequest updateRequest(MentalThreadResponse thread,
                                                    AttentionState attentionState,
                                                    int load,
                                                    String loadReason) {
        return new UpdateMentalThreadRequest(
                thread.title(),
                thread.description(),
                attentionState,
                thread.desiredResolution(),
                thread.targetCloseDate(),
                thread.hardDeadlineDate(),
                thread.nextReviewDate(),
                load,
                loadReason
        );
    }
}
