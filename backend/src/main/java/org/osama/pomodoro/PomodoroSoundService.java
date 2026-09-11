package org.osama.pomodoro;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PomodoroSoundService {
    public static final long MAX_FILE_SIZE_BYTES = 25L * 1024L * 1024L;
    private static final int MAX_SOUNDS_PER_USER = 10;

    private final PomodoroSoundRepository soundRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PomodoroSoundResponse> getSounds(String userId) {
        return soundRepository.findAllByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(PomodoroSoundResponse::from)
                .toList();
    }

    @Transactional
    public PomodoroSoundResponse upload(String userId, MultipartFile file) {
        validateFile(file);
        if (soundRepository.countByUserId(userId) >= MAX_SOUNDS_PER_USER) {
            throw new IllegalArgumentException("You can store up to 10 Pomodoro sounds.");
        }
        byte[] audioData;
        try {
            audioData = file.getBytes();
        } catch (IOException exception) {
            throw new IllegalArgumentException("The sound file could not be read.", exception);
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        String name = cleanFileName(file.getOriginalFilename());
        PomodoroSound sound = new PomodoroSound(
                UUID.randomUUID().toString(), user, name, "audio/mpeg", audioData.length, audioData);
        soundRepository.save(sound);
        log.info("Uploaded Pomodoro sound: userId={} soundId={} fileSize={}", userId, sound.getId(), audioData.length);
        return PomodoroSoundResponse.from(sound);
    }

    @Transactional(readOnly = true)
    public PomodoroSound getSound(String soundId, String userId) {
        return soundRepository.findByIdAndUserId(soundId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Pomodoro sound not found: " + soundId));
    }

    @Transactional
    public void delete(String soundId, String userId) {
        PomodoroSound sound = getSound(soundId, userId);
        User user = sound.getUser();
        if (soundId.equals(user.getPomodoroSoundId())) {
            user.setPomodoroSoundId(PomodoroSoundIds.BROWN_NOISE);
            userRepository.save(user);
        }
        soundRepository.delete(sound);
        log.info("Deleted Pomodoro sound: userId={} soundId={}", userId, soundId);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose an MP3 file to upload.");
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException("MP3 files must be 25 MB or smaller.");
        }
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !originalFilename.toLowerCase().endsWith(".mp3")) {
            throw new IllegalArgumentException("Only MP3 files can be uploaded.");
        }
    }

    private String cleanFileName(String originalFilename) {
        String fileName = StringUtils.cleanPath(originalFilename == null ? "sound.mp3" : originalFilename);
        int lastSlash = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
        if (lastSlash >= 0) fileName = fileName.substring(lastSlash + 1);
        if (fileName.isBlank()) fileName = "sound.mp3";
        return fileName.length() > 255 ? fileName.substring(fileName.length() - 255) : fileName;
    }

    public record PomodoroSoundResponse(String id, String name, long fileSize) {
        static PomodoroSoundResponse from(PomodoroSound sound) {
            return new PomodoroSoundResponse(sound.getId(), sound.getName(), sound.getFileSize());
        }
    }
}
