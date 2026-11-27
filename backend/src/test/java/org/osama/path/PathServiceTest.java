package org.osama.path;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.path.scoring.InputDirection;
import org.osama.path.scoring.InputPeriod;
import org.osama.path.scoring.InputScoring;
import org.osama.path.scoring.SignalCombine;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatMorality;
import org.osama.stat.StatService;
import org.osama.stat.StatType;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
@Execution(ExecutionMode.SAME_THREAD)
class PathServiceTest {
    private static final String USER_ID = "path-user";
    private static final String OTHER_USER_ID = "path-other-user";
    // A Thursday: the current week began on Sunday 2026-11-22.
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 26);
    private static final LocalDate THIS_SUNDAY = LocalDate.of(2026, 11, 22);
    private static final double DELTA = 1e-9;

    @Autowired private PathService pathService;
    @Autowired private PathOverviewService overviewService;
    @Autowired private StatService statService;
    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager entityManager;

    private StatDefinition gym;

    @BeforeEach
    void setUp() {
        userRepository.save(user(USER_ID));
        userRepository.save(user(OTHER_USER_ID));
        gym = statService.createDefinition("Gym", null, StatType.BOOLEAN, null, null, StatMorality.GOOD, null, USER_ID);
    }

    private static SignalRequest gymFourTimes(String statId) {
        return new SignalRequest(SignalCombine.AVERAGE,
                List.of(new SignalInputRequest(statId, null, null, InputScoring.TIMES, 4.0, null)));
    }

    private PathResponse bodyPath() {
        return pathService.createPath(new PathRequest("Body", "#f08e84", "body", null, null, gymFourTimes(gym.getId())), USER_ID);
    }

    // Creating and editing paths

    @Test
    void aPathIsCreatedWithItsSignal() {
        PathResponse body = bodyPath();

        assertEquals("Body", body.name());
        assertEquals("#F08E84", body.color());
        assertEquals(SignalCombine.AVERAGE, body.signal().combineMethod());
        SignalInputResponse input = body.signal().inputs().get(0);
        assertEquals("Gym", input.statName());
        assertEquals("VALUE", input.valueSource());
        assertEquals(StatType.BOOLEAN, input.valueType());
        assertEquals(InputPeriod.WEEK, input.period());
        assertEquals(1, input.weight(), DELTA);
    }

    @Test
    void aPathCannotExistWithoutASignalInput() {
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(
                new PathRequest("Body", "#F08E84", "body", null, null, null), USER_ID));
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(
                new PathRequest("Body", "#F08E84", "body", null, null, new SignalRequest(SignalCombine.AVERAGE, List.of())), USER_ID));
    }

    @Test
    void anInputsDirectionDefaultsFromTheStatsMorality() {
        StatDefinition takeaways = statService.createDefinition("Takeaways", null, StatType.NUMBER, null, null,
                StatMorality.BAD, 0.0, USER_ID);

        PathResponse money = pathService.createPath(new PathRequest("Money", "#E9B872", "money", null, null,
                new SignalRequest(null, List.of(new SignalInputRequest(takeaways.getId(), null, null, InputScoring.TIMES, 1.0, null)))),
                USER_ID);

        assertEquals(InputDirection.LESS_IS_BETTER, money.signal().inputs().get(0).direction());
    }

    @Test
    void inputsAreValidated() {
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(new PathRequest("Body", "#F08E84", "body", null, null,
                new SignalRequest(null, List.of(new SignalInputRequest(gym.getId(), "DURATION", null, InputScoring.TOTAL, 60.0, null)))),
                USER_ID), "the gym stat has no duration input");
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(new PathRequest("Body", "#F08E84", "body", null, null,
                new SignalRequest(null, List.of(new SignalInputRequest(gym.getId(), null, InputDirection.MORE_IS_BETTER, InputScoring.TIMES, 0.0, null)))),
                USER_ID), "more-is-better targets must be above zero");
    }

    @Test
    void anotherUsersStatCannotBeAnInput() {
        StatDefinition theirs = statService.createDefinition("Theirs", null, StatType.BOOLEAN, null, null, OTHER_USER_ID);

        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(
                new PathRequest("Body", "#F08E84", "body", null, null, gymFourTimes(theirs.getId())), USER_ID));
    }

    @Test
    void colourAndIconAreValidated() {
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(
                new PathRequest("Body", "red", "body", null, null, gymFourTimes(gym.getId())), USER_ID));
        assertThrows(IllegalArgumentException.class, () -> pathService.createPath(
                new PathRequest("Body", "#F08E84", "rocket", null, null, gymFourTimes(gym.getId())), USER_ID));
    }

    @Test
    void replacingTheSignalSwapsItsInputs() {
        PathResponse body = bodyPath();
        StatDefinition protein = statService.createDefinition("Protein", null, StatType.NUMBER, null, null, USER_ID);

        PathResponse replaced = pathService.replaceSignal(body.id(), new SignalRequest(SignalCombine.WEAKEST, List.of(
                new SignalInputRequest(gym.getId(), null, null, InputScoring.TIMES, 3.0, null),
                new SignalInputRequest(protein.getId(), null, null, InputScoring.DAYS_MET, 120.0, 2.0))), USER_ID);
        entityManager.flush();
        entityManager.clear();

        assertEquals(SignalCombine.WEAKEST, replaced.signal().combineMethod());
        assertEquals(List.of("Gym", "Protein"), pathService.getPath(body.id(), USER_ID).signal().inputs().stream()
                .map(SignalInputResponse::statName).toList());
    }

    @Test
    void anUpdateOnlyChangesTheFieldsItNames() {
        PathResponse body = bodyPath();

        PathResponse paused = pathService.updatePath(body.id(), new PathRequest(null, null, null, true, null, null), USER_ID);

        assertEquals("Body", paused.name());
        assertEquals(true, paused.paused());
        assertEquals(1, paused.signal().inputs().size());
    }

    @Test
    void myOrderFollowsTheGivenIds() {
        PathResponse body = bodyPath();
        PathResponse writer = pathService.createPath(new PathRequest("Writer", "#A395F2", "writer", null, null, gymFourTimes(gym.getId())), USER_ID);

        List<PathResponse> ordered = pathService.reorder(List.of(writer.id(), body.id()), USER_ID);

        assertEquals(List.of("Writer", "Body"), ordered.stream().map(PathResponse::name).toList());
    }

    @Test
    void pathsBelongToTheirOwner() {
        PathResponse body = bodyPath();

        assertThrows(ResourceNotFoundException.class, () -> pathService.getPath(body.id(), OTHER_USER_ID));
        assertThrows(ResourceNotFoundException.class, () -> pathService.deletePath(body.id(), OTHER_USER_ID));
    }

    @Test
    void deletedPathsAreGone() {
        PathResponse body = bodyPath();

        pathService.deletePath(body.id(), USER_ID);
        entityManager.flush();

        assertEquals(List.of(), pathService.getPaths(USER_ID));
    }

    // Page switches

    @Test
    void theSwitchesHaveDefaultsAndRememberChanges() {
        assertEquals(new PathViewResponse(PathSort.ATTENTION, PathShape.CURVED, PathEdges.FOLLOW_WEEKS), pathService.getView(USER_ID));

        pathService.updateView(new PathViewRequest(null, PathShape.STRAIGHT, null), USER_ID);

        assertEquals(new PathViewResponse(PathSort.ATTENTION, PathShape.STRAIGHT, PathEdges.FOLLOW_WEEKS), pathService.getView(USER_ID));
    }

    // The overview

    @Test
    void theOverviewScoresPastWeeksFromExistingEntriesAndTheCurrentWeekByPace() {
        bodyPath();
        LocalDate lastSunday = THIS_SUNDAY.minusWeeks(1);
        for (int day = 0; day < 4; day++) statService.recordEntry(gym.getId(), lastSunday.plusDays(day), 1, USER_ID);
        statService.recordEntry(gym.getId(), THIS_SUNDAY, 1, USER_ID);
        statService.recordEntry(gym.getId(), THIS_SUNDAY.plusDays(2), 1, USER_ID);

        PathOverviewResponse overview = overviewService.getOverview(THIS_SUNDAY.minusWeeks(2), TODAY, USER_ID);

        List<WeekStrength> weeks = overview.paths().get(0).weeks();
        assertEquals(List.of(THIS_SUNDAY.minusWeeks(2), lastSunday, THIS_SUNDAY), weeks.stream().map(WeekStrength::weekStart).toList());
        assertEquals(0, weeks.get(0).strength(), DELTA);
        assertEquals(1, weeks.get(1).strength(), DELTA);
        assertEquals(5, weeks.get(2).elapsedDays());
        assertEquals(2, weeks.get(2).inputs().get(0).achieved(), DELTA);
        assertEquals(2 / (4 * 5 / 7.0), weeks.get(2).strength(), DELTA);
    }

    @Test
    void theOverviewDefaultsToAYearOfWeeksAndCarriesTheSwitches() {
        bodyPath();

        PathOverviewResponse overview = overviewService.getOverview(null, TODAY, USER_ID);

        assertEquals(PathOverviewService.DEFAULT_WEEKS, overview.paths().get(0).weeks().size());
        assertEquals(PathSort.ATTENTION, overview.view().sort());
    }

    @Test
    void anInputWhoseStatWasDeletedScoresNothing() {
        PathResponse body = bodyPath();
        statService.recordEntry(gym.getId(), THIS_SUNDAY, 1, USER_ID);
        statService.deleteDefinition(gym.getId(), USER_ID);
        entityManager.flush();
        entityManager.clear();

        PathOverviewResponse overview = overviewService.getOverview(THIS_SUNDAY, TODAY, USER_ID);

        assertNull(overview.paths().get(0).path().signal().inputs().get(0).statName());
        assertEquals(0, overview.paths().get(0).weeks().get(0).strength(), DELTA);
        assertEquals(body.id(), overview.paths().get(0).path().id());
    }

    @Test
    void aPreviewScoresRecentWeeksWithoutSaving() {
        statService.recordEntry(gym.getId(), THIS_SUNDAY.minusWeeks(1), 1, USER_ID);

        SignalPreviewResponse preview = overviewService.preview(gymFourTimes(gym.getId()), TODAY, USER_ID);

        assertEquals(PathOverviewService.PREVIEW_WEEKS, preview.weeks().size());
        assertEquals(0.25, preview.weeks().get(PathOverviewService.PREVIEW_WEEKS - 2).strength(), DELTA);
        assertEquals(List.of(), pathService.getPaths(USER_ID));
    }

    private static User user(String id) {
        return User.builder()
                .id(id)
                .keycloakId(id + "-keycloak")
                .email(id + "@example.com")
                .firstName("Path")
                .lastName("Tester")
                .username(id)
                .active(true)
                .build();
    }
}
