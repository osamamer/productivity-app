package org.osama.reminder;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationMigrationTest {

    @Test
    void notificationInboxMigrationClassifiesExistingCalendarAndTaskReminders() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:notification-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("""
                    CREATE TABLE reminder (
                        reminder_id VARCHAR(255) PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        date_time TIMESTAMP WITH TIME ZONE NOT NULL,
                        event_id VARCHAR(255),
                        dispatched_at TIMESTAMP WITH TIME ZONE,
                        acknowledged_at TIMESTAMP WITH TIME ZONE
                    )
                    """);
            connection.createStatement().execute("""
                    INSERT INTO reminder (reminder_id, user_id, date_time, event_id)
                    VALUES ('existing-reminder', 'user-1', CURRENT_TIMESTAMP, 'event-1')
                    """);
            connection.createStatement().execute("""
                    INSERT INTO reminder (reminder_id, user_id, date_time)
                    VALUES ('existing-task-reminder', 'user-1', CURRENT_TIMESTAMP)
                    """);

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/031-unify-notification-delivery.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());
            Liquibase classification = new Liquibase(
                    "db/changelog/changes/032-classify-legacy-task-reminders.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            classification.update(new Contexts(), new LabelExpression());

            try (var result = connection.createStatement().executeQuery("""
                    SELECT md5sum
                    FROM databasechangelog
                    WHERE id = '031-unify-notification-delivery' AND author = 'codex'
                    """)) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("md5sum")).isEqualTo("8:32b57c0c503d4687e32777245be6f277");
            }

            try (var result = connection.createStatement().executeQuery("""
                    SELECT notification_type, created_at
                    FROM reminder
                    WHERE reminder_id = 'existing-reminder'
                    """)) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("notification_type")).isEqualTo("CALENDAR_EVENT");
                assertThat(result.getTimestamp("created_at")).isNotNull();
            }

            try (var result = connection.createStatement().executeQuery("""
                    SELECT notification_type, title, target_url
                    FROM reminder
                    WHERE reminder_id = 'existing-task-reminder'
                    """)) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("notification_type")).isEqualTo("TASK_REMINDER");
                assertThat(result.getString("title")).isEqualTo("Task reminder");
                assertThat(result.getString("target_url")).isEqualTo("/tasks");
            }
            database.close();
        }
    }
}
