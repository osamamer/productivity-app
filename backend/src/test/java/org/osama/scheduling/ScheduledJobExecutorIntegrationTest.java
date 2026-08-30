package org.osama.scheduling;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Execution(ExecutionMode.SAME_THREAD)
@TestExecutionListeners(
        listeners = DependencyInjectionTestExecutionListener.class,
        mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS
)
class ScheduledJobExecutorIntegrationTest {
    @Autowired private ScheduledJobExecutor executor;
    @Autowired private ScheduledJobRepository scheduledJobRepository;
    @Autowired private UserRepository userRepository;

    private String jobId;
    private String userId;

    @BeforeEach
    void setUp() {
        userId = "job-transaction-user-" + UUID.randomUUID();
        User user = userRepository.save(User.builder()
                .id(userId)
                .keycloakId("keycloak-" + userId)
                .email(userId + "@example.com")
                .firstName("Job")
                .lastName("Tester")
                .username(userId)
                .active(true)
                .build());

        jobId = "failing-job-" + UUID.randomUUID();
        ScheduledJob job = new ScheduledJob();
        job.setJobId(jobId);
        job.setJobType(JobType.PAUSE_SESSION);
        job.setAssociatedTaskId("missing-task");
        job.setDueDate(LocalDateTime.now().minusSeconds(1));
        job.setScheduled(true);
        job.setUser(user);
        scheduledJobRepository.save(job);
    }

    @AfterEach
    void tearDown() {
        scheduledJobRepository.findById(jobId).ifPresent(scheduledJobRepository::delete);
        userRepository.findUserById(userId).ifPresent(userRepository::delete);
    }

    @Test
    void failedTransitionRollsBackItsClaimSoTheJobCanRetry() {
        assertThrows(RuntimeException.class, () -> executor.execute(jobId));

        assertTrue(scheduledJobRepository.findById(jobId).orElseThrow().isScheduled());
    }
}
