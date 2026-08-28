package org.osama.mentalthread;

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

class MentalThreadTaskMigrationTest {

    @Test
    void deletingAThreadDetachesItsTasksInsteadOfDeletingThem() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:mental-thread-task-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("CREATE TABLE mental_thread (thread_id VARCHAR(255) PRIMARY KEY)");
            connection.createStatement().execute("CREATE TABLE task (task_id VARCHAR(255) PRIMARY KEY)");

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/024-connect-tasks-to-mental-threads.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());

            connection.createStatement().execute("INSERT INTO mental_thread (thread_id) VALUES ('thread-1')");
            connection.createStatement().execute(
                    "INSERT INTO task (task_id, mental_thread_id) VALUES ('task-1', 'thread-1')");
            connection.createStatement().execute("DELETE FROM mental_thread WHERE thread_id = 'thread-1'");

            try (var result = connection.createStatement().executeQuery(
                    "SELECT mental_thread_id FROM task WHERE task_id = 'task-1'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString("mental_thread_id")).isNull();
            }
            database.close();
        }
    }
}
