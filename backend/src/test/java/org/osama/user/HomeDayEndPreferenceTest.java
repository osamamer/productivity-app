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
class HomeDayEndPreferenceTest {
    @Autowired private UserService userService;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void defaultsToMidnightAndSavesEachAllowedHour() throws Exception {
        String userId = saveUser();
        assertEquals(0, userRepository.findById(userId).orElseThrow().getHomeDayEndHour());

        for (int hour = 0; hour <= 5; hour++) {
            userService.updatePreferences(userId, hourUpdate(hour));
            assertEquals(hour, userRepository.findById(userId).orElseThrow().getHomeDayEndHour());
        }
    }

    @Test
    void rejectsHoursOutsideMidnightThroughFiveAm() throws Exception {
        String userId = saveUser();

        assertThrows(IllegalArgumentException.class,
                () -> userService.updatePreferences(userId, hourUpdate(-1)));
        assertThrows(IllegalArgumentException.class,
                () -> userService.updatePreferences(userId, hourUpdate(6)));
    }

    private UserPreferenceUpdates hourUpdate(int hour) throws Exception {
        return objectMapper.readValue("{\"homeDayEndHour\":" + hour + "}", UserPreferenceUpdates.class);
    }

    private String saveUser() {
        String id = UUID.randomUUID().toString();
        userRepository.save(User.builder()
                .id(id)
                .email(id + "@test.com")
                .firstName("Home day")
                .lastName("Preference")
                .username(id)
                .active(true)
                .build());
        return id;
    }
}
