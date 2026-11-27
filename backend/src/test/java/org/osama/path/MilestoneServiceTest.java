package org.osama.path;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.path.scoring.InputScoring;
import org.osama.path.scoring.SignalCombine;
import org.osama.project.CheckpointAggregation;
import org.osama.project.CheckpointRequest;
import org.osama.project.CheckpointResponse;
import org.osama.project.CheckpointService;
import org.osama.project.ProjectService;
import org.osama.requests.NewTaskRequest;
import org.osama.requests.UpdateTaskRequest;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatService;
import org.osama.stat.StatType;
import org.osama.task.Task;
import org.osama.task.TaskRepository;
import org.osama.task.TaskService;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class MilestoneServiceTest {
    private static final String USER_ID = "milestone-user";
    private static final String OTHER_USER_ID = "milestone-other-user";
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 26);
    private static final double DELTA = 1e-9;

    @Autowired private PathService pathService;
    @Autowired private PathOverviewService overviewService;
    @Autowired private MilestoneService milestoneService;
    @Autowired private CheckpointService checkpointService;
    @Autowired private ProjectService projectService;
    @Autowired private StatService statService;
    @Autowired private TaskService taskService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;

    private StatDefinition words;
    private PathResponse writer;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID));
        userRepository.save(user(OTHER_USER_ID));
        words = statService.createDefinition("Words", null, StatType.NUMBER, null, null, USER_ID);
        writer = pathService.createPath(new PathRequest("Writer", "#A395F2", "writer", null, null,
                new SignalRequest(SignalCombine.AVERAGE, List.of(
                        new SignalInputRequest(words.getId(), null, null, InputScoring.TOTAL, 2600.0, null)))), USER_ID);
    }

    private MilestoneResponse rewrite(LocalDate targetDate) {
        return milestoneService.createMilestone(writer.id(), new MilestoneRequest("Finish the rewrite", targetDate), TODAY, USER_ID);
    }

    private CheckpointResponse checkpoint(MilestoneResponse milestone, String name, double baseline, double target) {
        CheckpointRequest request = new CheckpointRequest(name, LocalDate.of(2026, 12, 31), words.getId(),
                CheckpointAggregation.SUM, baseline, target);
        request.setCountFrom(LocalDate.of(2026, 11, 1));
        return checkpointService.createCheckpoint(milestone.projectId(), request, TODAY, USER_ID);
    }

    private void flush() {
        entityManager.flush();
        entityManager.clear();
    }

    // Milestones and their projects

    @Test
    void creatingAMilestoneCreatesTheProjectItEnds() {
        MilestoneResponse milestone = rewrite(LocalDate.of(2027, 7, 22));

        assertEquals("Finish the rewrite", milestone.name());
        assertEquals("Finish the rewrite", projectService.getProject(milestone.projectId(), USER_ID).name());
        assertEquals(LocalDate.of(2027, 7, 22), milestone.targetDate());
        assertFalse(milestone.done());
    }

    @Test
    void aMilestoneWithoutADateIsAllowedAndADateCanBeCleared() {
        MilestoneResponse dated = rewrite(LocalDate.of(2027, 7, 22));

        MilestoneResponse someday = milestoneService.updateMilestone(writer.id(), dated.id(), new MilestoneRequest(null, null), TODAY, USER_ID);

        assertNull(someday.targetDate());
        assertEquals("Finish the rewrite", someday.name());
    }

    @Test
    void renamingAMilestoneRenamesItsProject() {
        MilestoneResponse milestone = rewrite(null);
        MilestoneRequest rename = new MilestoneRequest();
        rename.setName("Second draft");

        milestoneService.updateMilestone(writer.id(), milestone.id(), rename, TODAY, USER_ID);

        assertEquals("Second draft", projectService.getProject(milestone.projectId(), USER_ID).name());
    }

    @Test
    void markingAMilestoneDoneCompletesItsProject() {
        MilestoneResponse milestone = rewrite(null);
        MilestoneRequest done = new MilestoneRequest();
        done.setDone(true);

        MilestoneResponse marked = milestoneService.updateMilestone(writer.id(), milestone.id(), done, TODAY, USER_ID);

        assertTrue(marked.done());
        assertEquals(1, marked.progress(), DELTA);
        assertEquals(LocalDate.now(), marked.doneOn());
    }

    @Test
    void milestonesBelongToTheirOwner() {
        MilestoneResponse milestone = rewrite(null);

        assertThrows(ResourceNotFoundException.class, () -> milestoneService.deleteMilestone(writer.id(), milestone.id(), OTHER_USER_ID));
        assertThrows(ResourceNotFoundException.class, () -> milestoneService.createMilestone(
                writer.id(), new MilestoneRequest("Theirs", null), TODAY, OTHER_USER_ID));
    }

    // Checkpoints

    @Test
    void aCheckpointMeasuresItsStatFromItsStartWithTheBaseline() {
        MilestoneResponse milestone = rewrite(null);
        statService.recordEntry(words.getId(), LocalDate.of(2026, 11, 20), 2000, USER_ID);

        CheckpointResponse actTwo = checkpoint(milestone, "Act II done", 70_100, 80_000);

        assertEquals(72_100, actTwo.current(), DELTA);
        assertEquals("Words", actTwo.metric().statName());
        assertNull(actTwo.reachedOn());
    }

    @Test
    void aMilestoneIsDoneOnceAllItsCheckpointsAreReached() {
        MilestoneResponse milestone = rewrite(null);
        checkpoint(milestone, "Ch14", 0, 1000);
        checkpoint(milestone, "Ch15", 0, 3000);
        statService.recordEntry(words.getId(), LocalDate.of(2026, 11, 10), 1500, USER_ID);

        MilestoneResponse halfway = overviewService.getOverview(null, TODAY, USER_ID).paths().get(0).milestones().get(0);
        assertFalse(halfway.done());
        assertEquals((1 + 0.5) / 2, halfway.progress(), DELTA);

        statService.recordEntry(words.getId(), LocalDate.of(2026, 11, 24), 1500, USER_ID);
        MilestoneResponse done = overviewService.getOverview(null, TODAY, USER_ID).paths().get(0).milestones().get(0);
        assertTrue(done.done());
        assertEquals(LocalDate.of(2026, 11, 24), done.doneOn());
    }

    @Test
    void checkpointsNeedAStatAndATarget() {
        MilestoneResponse milestone = rewrite(null);

        assertThrows(IllegalArgumentException.class, () -> checkpointService.createCheckpoint(milestone.projectId(),
                new CheckpointRequest("No stat", null, null, CheckpointAggregation.SUM, null, 10.0), TODAY, USER_ID));
        assertThrows(IllegalArgumentException.class, () -> checkpointService.createCheckpoint(milestone.projectId(),
                new CheckpointRequest("No target", null, words.getId(), CheckpointAggregation.SUM, null, null), TODAY, USER_ID));
    }

    // Tasks under checkpoints

    @Test
    void aTaskPutUnderACheckpointJoinsItsProject() {
        MilestoneResponse milestone = rewrite(null);
        CheckpointResponse actTwo = checkpoint(milestone, "Act II done", 0, 100);
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Outline Act II");
        request.setCheckpointId(actTwo.id());

        Task task = taskService.createTask(request, USER_ID);

        assertEquals(milestone.projectId(), task.getProjectId());
        assertEquals(1, checkpointService.getCheckpoints(milestone.projectId(), TODAY, USER_ID).get(0).taskCount());
    }

    @Test
    void movingATaskToAnotherProjectLeavesItsCheckpoint() {
        MilestoneResponse milestone = rewrite(null);
        CheckpointResponse actTwo = checkpoint(milestone, "Act II done", 0, 100);
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Outline Act II");
        request.setCheckpointId(actTwo.id());
        Task task = taskService.createTask(request, USER_ID);
        UpdateTaskRequest move = new UpdateTaskRequest();
        move.setProjectId(null);

        taskService.updateTask(task.getTaskId(), move, USER_ID);

        Task moved = taskRepository.findById(task.getTaskId()).orElseThrow();
        assertNull(moved.getProjectId());
        assertNull(moved.getCheckpointId());
    }

    // Deleting

    @Test
    void deletingAMilestoneDeletesItsProjectAndKeepsItsTasksUnassigned() {
        MilestoneResponse milestone = rewrite(null);
        CheckpointResponse actTwo = checkpoint(milestone, "Act II done", 0, 100);
        NewTaskRequest request = new NewTaskRequest();
        request.setName("Outline Act II");
        request.setCheckpointId(actTwo.id());
        Task task = taskService.createTask(request, USER_ID);

        milestoneService.deleteMilestone(writer.id(), milestone.id(), USER_ID);
        flush();

        assertThrows(ResourceNotFoundException.class, () -> projectService.getProject(milestone.projectId(), USER_ID));
        Task kept = taskRepository.findById(task.getTaskId()).orElseThrow();
        assertNull(kept.getProjectId());
        assertNull(kept.getCheckpointId());
        assertEquals(List.of(), overviewService.getOverview(null, TODAY, USER_ID).paths().get(0).milestones());
    }

    @Test
    void deletingAMilestonesProjectElsewhereRemovesTheMilestone() {
        MilestoneResponse milestone = rewrite(null);

        projectService.deleteProject(milestone.projectId(), USER_ID);
        flush();

        assertEquals(List.of(), overviewService.getOverview(null, TODAY, USER_ID).paths().get(0).milestones());
    }

    @Test
    void deletingAPathDeletesItsMilestones() {
        MilestoneResponse milestone = rewrite(null);

        pathService.deletePath(writer.id(), USER_ID);
        flush();

        assertThrows(ResourceNotFoundException.class, () -> projectService.getProject(milestone.projectId(), USER_ID));
    }

    private static User user(String id) {
        return User.builder()
                .id(id)
                .keycloakId(id + "-keycloak")
                .email(id + "@example.com")
                .firstName("Milestone")
                .lastName("Tester")
                .username(id)
                .active(true)
                .build();
    }
}
