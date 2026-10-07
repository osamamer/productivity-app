package org.osama.project;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectMigrationTest {

    @Test
    void projectMigrationBackfillsUpdatedAtAndLinksTaskSeriesToProjects() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:project-migration-" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            execute(connection, "CREATE TABLE task_series (series_id VARCHAR(255) PRIMARY KEY)");

            applyChangeLog(connection, "db/changelog/changes/005-create-project.yaml");
            execute(connection, """
                    INSERT INTO project (project_id, creation_date_time, name)
                    VALUES ('project-1', TIMESTAMP '2026-01-02 03:04:05', 'Existing project')
                    """);

            applyChangeLog(connection, "db/changelog/changes/069-add-project-updated-at.yaml");

            assertThat(updatedAt(connection, "project-1"))
                    .isEqualTo(Timestamp.valueOf(LocalDateTime.of(2026, 1, 2, 3, 4, 5)));
            assertThat(isNullable(connection, "project", "updated_at")).isFalse();
            assertThat(importedKeyRule(connection, "task_series", "fk_app_task_series_project", "DELETE_RULE"))
                    .isEqualTo(DatabaseMetaData.importedKeySetNull);
            assertThat(importedKeyRule(connection, "task_series", "fk_app_task_series_project", "UPDATE_RULE"))
                    .isEqualTo(DatabaseMetaData.importedKeyCascade);
        }
    }

    private void applyChangeLog(Connection connection, String path) throws Exception {
        Database database = DatabaseFactory.getInstance()
                .findCorrectDatabaseImplementation(new JdbcConnection(connection));
        Liquibase liquibase = new Liquibase(path, new ClassLoaderResourceAccessor(), database);
        liquibase.update(new Contexts(), new LabelExpression());
        // Liquibase leaves the shared connection in manual-commit mode, so a later
        // Liquibase run would otherwise roll back statements issued between changesets.
        connection.commit();
        connection.setAutoCommit(true);
    }

    private void execute(Connection connection, String sql) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private Timestamp updatedAt(Connection connection, String projectId) throws Exception {
        try (Statement statement = connection.createStatement();
             ResultSet rows = statement.executeQuery(
                     "SELECT updated_at FROM project WHERE project_id = '" + projectId + "'")) {
            assertThat(rows.next()).isTrue();
            Timestamp updatedAt = rows.getTimestamp("updated_at");
            assertThat(rows.wasNull()).isFalse();
            return updatedAt;
        }
    }

    private boolean isNullable(Connection connection, String table, String column) throws Exception {
        try (ResultSet columns = connection.getMetaData().getColumns(
                connection.getCatalog(), null, tableName(connection, table), null)) {
            while (columns.next()) {
                if (column.equalsIgnoreCase(columns.getString("COLUMN_NAME"))) {
                    return columns.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls;
                }
            }
        }
        throw new IllegalStateException("Column not found: " + table + "." + column);
    }

    private int importedKeyRule(Connection connection, String table, String constraintName, String ruleColumn)
            throws Exception {
        try (ResultSet keys = connection.getMetaData().getImportedKeys(
                connection.getCatalog(), null, tableName(connection, table))) {
            while (keys.next()) {
                if (constraintName.equalsIgnoreCase(keys.getString("FK_NAME"))) {
                    assertThat(keys.getString("PKTABLE_NAME")).isEqualToIgnoringCase("project");
                    assertThat(keys.getString("PKCOLUMN_NAME")).isEqualToIgnoringCase("project_id");
                    assertThat(keys.getString("FKCOLUMN_NAME")).isEqualToIgnoringCase("project_id");
                    return keys.getShort(ruleColumn);
                }
            }
        }
        throw new IllegalStateException("Foreign key not found: " + constraintName);
    }

    private String tableName(Connection connection, String expected) throws Exception {
        try (ResultSet tables = connection.getMetaData().getTables(
                connection.getCatalog(), null, null, new String[]{"TABLE"})) {
            while (tables.next()) {
                String name = tables.getString("TABLE_NAME");
                if (name.equalsIgnoreCase(expected)) {
                    return name;
                }
            }
        }
        throw new IllegalStateException("Table not found: " + expected);
    }
}
