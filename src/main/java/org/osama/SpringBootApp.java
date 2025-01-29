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
    @PostConstruct
    public void init() {
        System.out.println("System Default TimeZone: " + TimeZone.getDefault().getID());
        System.out.println("System Time: " + new Date());
        System.out.println("JVM arg timezone: " + System.getProperty("user.timezone"));
        System.out.println("ZoneId Default: " + ZoneId.systemDefault());
        TimeZone tz = TimeZone.getTimeZone("Asia/Amman");
        System.out.println("Is in DST: " + tz.inDaylightTime(new Date()));
        System.out.println("DST Offset: " + tz.getDSTSavings()/3600000 + " hours");
        System.out.println("\nDetailed Time Analysis:");
        System.out.println("Current Instant (UTC): " + Instant.now());
        System.out.println("System.currentTimeMillis(): " + System.currentTimeMillis());

        ZonedDateTime now = ZonedDateTime.now();
        System.out.println("ZonedDateTime.now(): " + now);
        System.out.println("ZonedDateTime offset: " + now.getOffset());

        // Force a specific instant to see how it's interpreted
        Instant specificInstant = Instant.now();
        ZonedDateTime zonedTime = specificInstant.atZone(ZoneId.of("Asia/Amman"));
        System.out.println("Forced conversion of current instant: " + zonedTime);
    }
    public static void main(String[] args) {
        SpringApplication.run(SpringBootApp.class);
    }

}
