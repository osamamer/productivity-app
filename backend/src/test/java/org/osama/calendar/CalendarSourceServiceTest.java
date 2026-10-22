package org.osama.calendar;

import liquibase.changelog.ChangeLogParameters;
import liquibase.parser.core.yaml.YamlChangeLogParser;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;
import org.osama.event.CalendarEventRequest;
import org.osama.event.CalendarEventRepository;
import org.osama.event.CalendarEventService;
import org.osama.reminder.ReminderRepository;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class CalendarSourceServiceTest {
    @Autowired CalendarSourceService sources;
    @Autowired CalendarEventRepository events;
    @Autowired CalendarEventService eventService;
    @Autowired CalendarSourceRepository sourceRepository;
    @Autowired ReminderRepository reminders;
    @Autowired UserRepository users;

    @Test
    void externalSourceMigrationParses() throws Exception {
        var changeLog = new YamlChangeLogParser().parse(
                "db/changelog/changes/085-external-calendar-sources.yaml",
                new ChangeLogParameters(), new ClassLoaderResourceAccessor());
        assertEquals(1, changeLog.getChangeSets().size());
    }

    @Test
    void fileImportIsIdempotentReadOnlyAndRemovedWithItsCalendar() {
        String userId = UUID.randomUUID().toString();
        users.save(User.builder().id(userId).keycloakId(userId).email(userId + "@example.com")
                .firstName("Import").lastName("Tester").username(userId).active(true).build());
        String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String payload = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//Claritard Test//EN
                BEGIN:VEVENT
                UID:one
                DTSTAMP:20261001T000000Z
                DTSTART;VALUE=DATE:%s
                SUMMARY:Imported
                END:VEVENT
                END:VCALENDAR
                """.formatted(date);

        CalendarSourceResponse source = sources.addFile(userId, "Imported", "blue", payload.getBytes(StandardCharsets.UTF_8));
        var imported = events.findAllBySourceId(source.id());
        assertEquals(1, imported.size());
        String eventId = imported.getFirst().getId();
        assertTrue(reminders.findByEventId(eventId).isEmpty());
        assertThrows(IllegalArgumentException.class,
                () -> eventService.updateEvent(eventId, new CalendarEventRequest(), userId));
        assertThrows(IllegalArgumentException.class, () -> eventService.deleteEvent(eventId, userId));

        sources.sync(userId, source.id());
        assertEquals(eventId, events.findAllBySourceId(source.id()).getFirst().getId());
        assertThrows(org.osama.exceptions.ResourceNotFoundException.class,
                () -> sources.sync("another-user", source.id()));

        CalendarSource stored = sourceRepository.findById(source.id()).orElseThrow();
        stored.setSourcePayload("not a calendar");
        sourceRepository.save(stored);
        assertThrows(IllegalArgumentException.class, () -> sources.sync(userId, source.id()));
        assertEquals(eventId, events.findAllBySourceId(source.id()).getFirst().getId());

        stored.setSourcePayload("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Claritard Test//EN\nEND:VCALENDAR\n");
        sourceRepository.save(stored);
        sources.sync(userId, source.id());
        assertTrue(events.findAllBySourceId(source.id()).isEmpty());
        sources.removeCalendar(userId, source.calendarId());
        assertTrue(events.findAllBySourceId(source.id()).isEmpty());
    }
}
