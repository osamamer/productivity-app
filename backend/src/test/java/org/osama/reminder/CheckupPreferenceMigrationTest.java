package org.osama.reminder;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class CheckupPreferenceMigrationTest {
    @Test
    void addsTheDefaultCheckupScheduleForExistingUsers() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:checkup-preferences-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("""
                    CREATE TABLE app_user (
                        id VARCHAR(255) PRIMARY KEY
                    )
                    """);
            connection.createStatement().execute("INSERT INTO app_user (id) VALUES ('user-1')");

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/040-add-checkup-notification-preferences.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());

            try (var result = connection.createStatement().executeQuery("""
                    SELECT checkup_notifications_enabled, checkup_interval_minutes,
                           checkup_start_time, checkup_times_per_day
                    FROM app_user
                    WHERE id = 'user-1'
                    """)) {
                assertThat(result.next()).isTrue();
                assertThat(result.getBoolean("checkup_notifications_enabled")).isTrue();
                assertThat(result.getInt("checkup_interval_minutes")).isEqualTo(180);
                assertThat(result.getTime("checkup_start_time").toLocalTime()).isEqualTo(LocalTime.of(9, 0));
                assertThat(result.getInt("checkup_times_per_day")).isEqualTo(5);
            }
            database.close();
        }
    }
}
