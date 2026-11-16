package org.osama.desktop;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

/**
 * Runs a private PostgreSQL server for the desktop app's local mode. Data lives in the
 * desktop data directory and survives restarts; the server listens on loopback only and on
 * a random free port, so it is never reachable from the network.
 *
 * Limitation: only one backend may use a data directory at a time. The desktop shell enforces
 * a single running instance; a second server on the same directory would fail to start.
 */
@Configuration
@Profile("desktop")
public class DesktopDatabaseConfig {

    private static final String DATABASE_USER = "postgres";
    private static final String DATABASE_NAME = "postgres";

    @Bean(destroyMethod = "close")
    EmbeddedPostgres embeddedPostgres(@Value("${app.desktop.data-directory}") Path dataDirectory) throws IOException {
        Path databaseDirectory = dataDirectory.resolve("postgres");
        Path runtimeDirectory = dataDirectory.resolve("postgres-runtime");
        Files.createDirectories(databaseDirectory);
        Files.createDirectories(runtimeDirectory);
        return EmbeddedPostgres.builder()
                .setDataDirectory(databaseDirectory)
                .setCleanDataDirectory(false)
                .setOverrideWorkingDirectory(runtimeDirectory.toFile())
                .setServerConfig("listen_addresses", "127.0.0.1")
                // The first launch runs initdb, which can be slow on older disks.
                .setPGStartupWait(Duration.ofSeconds(60))
                .start();
    }

    @Bean
    DataSource dataSource(EmbeddedPostgres embeddedPostgres) {
        return DataSourceBuilder.create()
                .url(embeddedPostgres.getJdbcUrl(DATABASE_USER, DATABASE_NAME))
                .username(DATABASE_USER)
                .build();
    }
}
