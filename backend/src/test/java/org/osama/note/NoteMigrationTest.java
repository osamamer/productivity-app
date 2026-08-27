package org.osama.note;

import liquibase.Contexts;
import liquibase.LabelExpression;
import liquibase.Liquibase;
import liquibase.database.Database;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import jakarta.persistence.Column;
import jakarta.persistence.Lob;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.DriverManager;

import static org.assertj.core.api.Assertions.assertThat;

class NoteMigrationTest {

    @Test
    void noteMigrationAppliesAgainstPostgresCompatibleH2() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:note-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1")) {
            connection.createStatement().execute("""
                    CREATE TABLE app_user (
                        id VARCHAR(255) PRIMARY KEY
                    )
                    """);

            Database database = DatabaseFactory.getInstance()
                    .findCorrectDatabaseImplementation(new JdbcConnection(connection));
            Liquibase liquibase = new Liquibase(
                    "db/changelog/changes/018-create-note.yaml",
                    new ClassLoaderResourceAccessor(),
                    database
            );
            liquibase.update(new Contexts(), new LabelExpression());
            database.close();
        }
    }

    @Test
    void noteContentUsesNativeTextInsteadOfPostgresLargeObjects() throws Exception {
        var contentField = Note.class.getDeclaredField("content");

        assertThat(contentField.getAnnotation(Lob.class)).isNull();
        assertThat(contentField.getAnnotation(Column.class).columnDefinition()).isEqualTo("TEXT");
    }
}
