package org.osama.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MeditationPreferenceTest {
    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void savesAnyWholeMinuteFromOneToSixty() throws Exception {
        String userId = saveUser();

        for (int minutes : new int[]{1, 7, 60}) {
            UserPreferenceUpdates updates = durationUpdate(minutes);
            userService.updatePreferences(userId, updates);

            assertEquals(minutes, userRepository.findById(userId).orElseThrow().getMeditationDurationMinutes());
        }
    }

    @Test
    void rejectsMinutesOutsideTheAllowedRange() throws Exception {
        String userId = saveUser();

        assertThrows(IllegalArgumentException.class,
                () -> userService.updatePreferences(userId, durationUpdate(0)));
        assertThrows(IllegalArgumentException.class,
                () -> userService.updatePreferences(userId, durationUpdate(61)));
    }

    private UserPreferenceUpdates durationUpdate(int minutes) throws Exception {
        return objectMapper.readValue("{\"meditationDurationMinutes\":" + minutes + "}", UserPreferenceUpdates.class);
    }

    private String saveUser() {
        String id = UUID.randomUUID().toString();
        userRepository.save(User.builder()
                .id(id)
                .email(id + "@test.com")
                .firstName("Meditation")
                .lastName("Preference")
                .username(id)
                .active(true)
                .build());
        return id;
    }
}
