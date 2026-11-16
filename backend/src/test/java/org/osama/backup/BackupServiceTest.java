package org.osama.backup;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.osama.note.Note;
import org.osama.stat.StatDefinition;
import org.osama.stat.StatType;
import org.osama.stat.StatEntry;
import org.osama.pomodoro.Pomodoro;
import org.osama.pomodoro.PomodoroSound;
import java.time.LocalDate;
import org.osama.user.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestExecutionListeners;
import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
import org.springframework.test.context.transaction.TransactionalTestExecutionListener;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@Import(BackupService.class)
@TestExecutionListeners(listeners = {DependencyInjectionTestExecutionListener.class,
        TransactionalTestExecutionListener.class}, mergeMode = TestExecutionListeners.MergeMode.REPLACE_DEFAULTS)
class BackupServiceTest {
    @Autowired EntityManager entities;
    @Autowired BackupService backups;

    @Test
    void snapshotIncludesSecretStatisticsButOnlyCurrentUsersActiveContent() {
        User owner = user("owner");
        User other = user("other");
        note(owner, "kept", false);
        note(owner, "removed", true);
        note(other, "private", false);
        stat(owner, "visible-stat", false);
        stat(owner, "secret-stat", true);
        stat(other, "other-stat", false);
        Pomodoro pomodoro = new Pomodoro();
        pomodoro.setPomodoroId("timer");
        pomodoro.setAssociatedTaskId("task");
        pomodoro.setUser(owner);
        pomodoro.setActive(true);
        entities.persist(pomodoro);
        entities.persist(new PomodoroSound("sound", owner, "Focus", "audio/mpeg", 2,
                new byte[] {1, 2}, "/private/server/path"));
        entities.flush();
        entities.clear();

        var snapshot = backups.capture(owner.getId());
        assertThat(snapshot.version()).isEqualTo(1);
        assertThat(snapshot.data().get("Note")).hasSize(1);
        assertThat(snapshot.data().get("Note").get(0)).containsEntry("title", "kept")
                .doesNotContainKeys("user", "userId", "softDeleted");
        assertThat(snapshot.data().get("StatDefinition")).hasSize(2);
        assertThat(snapshot.data().get("StatDefinition")).extracting(row -> row.get("name"))
                .containsExactlyInAnyOrder("visible-stat", "secret-stat");
        assertThat(snapshot.data().get("Pomodoro").get(0)).containsEntry("isActive", true);
        assertThat(snapshot.data().get("PomodoroSound").get(0)).doesNotContainKeys("audioData", "storagePath");
        assertThat(snapshot.data().get("StatEntry")).hasSize(2);
        assertThat(snapshot.data().get("User")).hasSize(1);
        assertThat(snapshot.data()).doesNotContainKeys("WebPushSubscription", "MobilePushToken", "SecretStatsAccess");
    }

    private User user(String id) {
        User user = User.builder().id(id).email(id + "@example.com").username(id)
                .firstName(id).lastName("Test").active(true).build();
        entities.persist(user);
        return user;
    }

    private void note(User owner, String title, boolean deleted) {
        entities.persist(Note.builder().id(title).user(owner).title(title).content("Saved text")
                .softDeleted(deleted).build());
    }

    private void stat(User owner, String name, boolean secret) {
        StatDefinition stat = new StatDefinition();
        stat.setId(name);
        stat.setName(name);
        stat.setType(StatType.NUMBER);
        stat.setDisplayOrder(0);
        stat.setUser(owner);
        stat.setSecret(secret);
        entities.persist(stat);
        entities.persist(StatEntry.builder().id(name + "-entry").user(owner).statDefinition(stat)
                .date(LocalDate.of(2026, 11, 16)).value(42).build());
    }
}
