package org.osama.path;

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
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PathMigrationTest {

    @Test
    void pathsMigrationCreatesOneSignalPerPathAndDeletesInputsWithTheirSignal() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:path-migration-" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            execute(connection, "CREATE TABLE app_user (id VARCHAR(255) PRIMARY KEY)");
            execute(connection, "INSERT INTO app_user (id) VALUES ('user-1')");

            applyChangeLog(connection, "db/changelog/changes/101-paths.yaml");
            execute(connection, """
                    INSERT INTO life_path (path_id, user_id, name, color, icon, created_at, updated_at)
                    VALUES ('path-1', 'user-1', 'Body', '#F08E84', 'body', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """);
            execute(connection, "INSERT INTO path_signal (signal_id, path_id, combine_method) VALUES ('signal-1', 'path-1', 'AVERAGE')");
            execute(connection, """
                    INSERT INTO path_signal_input (input_id, signal_id, stat_definition_id, value_source, direction, period, target, scoring)
                    VALUES ('input-1', 'signal-1', 'stat-1', 'VALUE', 'MORE_IS_BETTER', 'WEEK', 4, 'TIMES')
                    """);

            assertThatThrownBy(() -> execute(connection,
                    "INSERT INTO path_signal (signal_id, path_id, combine_method) VALUES ('signal-2', 'path-1', 'AVERAGE')"))
                    .isInstanceOf(SQLException.class);

            execute(connection, "DELETE FROM path_signal WHERE signal_id = 'signal-1'");
            assertThat(count(connection, "path_signal_input")).isZero();
        }
    }

    private void applyChangeLog(Connection connection, String path) throws Exception {
        Database database = DatabaseFactory.getInstance()
                .findCorrectDatabaseImplementation(new JdbcConnection(connection));
        Liquibase liquibase = new Liquibase(path, new ClassLoaderResourceAccessor(), database);
        liquibase.update(new Contexts(), new LabelExpression());
        connection.commit();
        connection.setAutoCommit(true);
    }

    private void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private int count(Connection connection, String table) throws SQLException {
        try (Statement statement = connection.createStatement();
             var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            rows.next();
            return rows.getInt(1);
        }
    }
}
