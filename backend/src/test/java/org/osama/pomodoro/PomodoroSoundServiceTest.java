package org.osama.pomodoro;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.osama.user.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PomodoroSoundServiceTest {

    @Autowired
    private PomodoroSoundService soundService;

    @Autowired
    private PomodoroSoundRepository soundRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserService userService;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        user = saveUser("sound-user");
        otherUser = saveUser("other-sound-user");
    }

    @Test
    void uploadsPrivateMp3AndAllowsItToBeSelected() throws Exception {
        byte[] bytes = {1, 2, 3, 4};
        PomodoroSoundService.PomodoroSoundResponse response = soundService.upload(
                user.getId(), new MockMultipartFile("file", "rain.mp3", "audio/mpeg", bytes));

        assertEquals("rain.mp3", response.name());
        assertEquals(bytes.length, response.fileSize());
        assertEquals(1, soundService.getSounds(user.getId()).size());
        assertEquals(0, soundService.getSounds(otherUser.getId()).size());
        assertArrayEquals(bytes, soundService.getAudio(response.id(), user.getId()).resource().getInputStream().readAllBytes());

        userService.updatePreferences(user.getId(), null, null, null, null, null, null, null, response.id());
        assertEquals(response.id(), userRepository.findById(user.getId()).orElseThrow().getPomodoroSoundId());
    }

    @Test
    void rejectsNonMp3FilesAndCrossUserReads() {
        assertThrows(IllegalArgumentException.class, () -> soundService.upload(
                user.getId(), new MockMultipartFile("file", "rain.wav", "audio/wav", new byte[]{1})));

        PomodoroSoundService.PomodoroSoundResponse response = soundService.upload(
                user.getId(), new MockMultipartFile("file", "rain.mp3", "audio/mpeg", new byte[]{1}));
        assertThrows(org.osama.exceptions.ResourceNotFoundException.class,
                () -> soundService.getSound(response.id(), otherUser.getId()));
    }

    @Test
    void deletingSelectedSoundFallsBackToBuiltInBrownNoise() {
        PomodoroSoundService.PomodoroSoundResponse response = soundService.upload(
                user.getId(), new MockMultipartFile("file", "rain.mp3", "audio/mpeg", new byte[]{1}));
        userService.updatePreferences(user.getId(), null, null, null, null, null, null, null, response.id());

        soundService.delete(response.id(), user.getId());

        assertEquals(PomodoroSoundIds.BROWN_NOISE,
                userRepository.findById(user.getId()).orElseThrow().getPomodoroSoundId());
        assertEquals(0, soundRepository.count());
    }

    private User saveUser(String prefix) {
        String suffix = UUID.randomUUID().toString();
        return userRepository.save(User.builder()
                .id(prefix + '-' + suffix)
                .email(prefix + '-' + suffix + "@test.com")
                .firstName("Sound")
                .lastName("Test")
                .username(prefix + '-' + suffix)
                .active(true)
                .build());
    }
}
