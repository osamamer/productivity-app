package org.osama.stat;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

import java.sql.DriverManager;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StatCompositeInputMigrationTest {

    @Test
    void addsCompanionInputColumnsAndPreservesExistingRows() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:stat-composite-input-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("CREATE TABLE stat_definition (id VARCHAR(255) PRIMARY KEY)");
            connection.createStatement().execute("CREATE TABLE stat_entry (id VARCHAR(255) PRIMARY KEY)");
            connection.createStatement().execute("INSERT INTO stat_definition (id) VALUES ('definition-1')");
            connection.createStatement().execute("INSERT INTO stat_entry (id) VALUES ('entry-1')");

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/092-composite-stat-inputs.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());

            try (var definition = connection.createStatement().executeQuery(
                    "SELECT additional_input_types FROM stat_definition WHERE id = 'definition-1'")) {
                assertTrue(definition.next());
                assertEquals("", definition.getString("additional_input_types"));
            }
            try (var entry = connection.createStatement().executeQuery(
                    "SELECT additional_values FROM stat_entry WHERE id = 'entry-1'")) {
                assertTrue(entry.next());
                assertEquals("", entry.getString("additional_values"));
            }
            database.close();
        }
    }
}
