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

class SecretStatAccessMigrationTest {

    @Test
    void keepsExistingStatisticsPublicAndCreatesHashedAccessStorage() throws Exception {
        try (var connection = DriverManager.getConnection(
                "jdbc:h2:mem:secret-stat-access-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("CREATE TABLE app_user (id VARCHAR(255) PRIMARY KEY)");
            connection.createStatement().execute("CREATE TABLE stat_definition (id VARCHAR(255) PRIMARY KEY)");
            connection.createStatement().execute("INSERT INTO app_user (id) VALUES ('user-1')");
            connection.createStatement().execute("INSERT INTO stat_definition (id) VALUES ('stat-1')");

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/093-secret-stat-access.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());

            try (var definition = connection.createStatement().executeQuery(
                    "SELECT secret FROM stat_definition WHERE id = 'stat-1'")) {
                assertTrue(definition.next());
                assertTrue(!definition.getBoolean("secret"));
            }
            connection.createStatement().execute("INSERT INTO secret_stats_access "
                    + "(token_hash, user_id, expires_at) VALUES ('hash', 'user-1', CURRENT_TIMESTAMP)");
            try (var access = connection.createStatement().executeQuery(
                    "SELECT token_hash FROM secret_stats_access WHERE user_id = 'user-1'")) {
                assertTrue(access.next());
                assertEquals("hash", access.getString("token_hash"));
            }
            database.close();
        }
    }
}
