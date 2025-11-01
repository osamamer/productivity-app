package org.osama;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.TimeZone;

@EnableScheduling
@SpringBootApplication
public class SpringBootApp {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(SpringBootApp.class);
        app.setAdditionalProfiles("postgres");
        app.run(args);
    }
}
