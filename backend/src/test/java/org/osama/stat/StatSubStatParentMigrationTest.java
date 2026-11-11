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

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StatSubStatParentMigrationTest {

    @Test
    void addsTheOptionalParentLinkAndClearsItWhenTheParentIsDeleted() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:stat-sub-stat-parent;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("CREATE TABLE stat_definition (id VARCHAR(255) PRIMARY KEY)");

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/095-stat-sub-stat-parent.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());

            connection.createStatement().execute(
                    "INSERT INTO stat_definition (id) VALUES ('parent'), ('child')");
            connection.createStatement().execute(
                    "UPDATE stat_definition SET parent_definition_id = 'parent' WHERE id = 'child'");
            try (var child = connection.createStatement().executeQuery(
                    "SELECT parent_definition_id FROM stat_definition WHERE id = 'child'")) {
                assertTrue(child.next());
                assertTrue("parent".equals(child.getString("parent_definition_id")));
            }

            connection.createStatement().execute("DELETE FROM stat_definition WHERE id = 'parent'");
            try (var child = connection.createStatement().executeQuery(
                    "SELECT parent_definition_id FROM stat_definition WHERE id = 'child'")) {
                assertTrue(child.next());
                assertNull(child.getString("parent_definition_id"));
            }
            database.close();
        }
    }
}
