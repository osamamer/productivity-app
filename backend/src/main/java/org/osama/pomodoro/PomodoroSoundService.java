package org.osama.pomodoro;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class PomodoroSoundService {
    public static final long MAX_FILE_SIZE_BYTES = 25L * 1024L * 1024L;
    private static final int MAX_SOUNDS_PER_USER = 10;

    private final PomodoroSoundRepository soundRepository;
    private final UserRepository userRepository;
    private final Path storageDirectory;

    public PomodoroSoundService(PomodoroSoundRepository soundRepository,
                                UserRepository userRepository,
                                @Value("${app.pomodoro.sounds.directory:./data/pomodoro-sounds}") String storageDirectory) {
        this.soundRepository = soundRepository;
        this.userRepository = userRepository;
        this.storageDirectory = Path.of(storageDirectory).toAbsolutePath().normalize();
    }

    @Transactional(readOnly = true)
    public List<PomodoroSoundResponse> getSounds(String userId) {
        return soundRepository.findMetadataByUserIdOrderByCreatedAtAsc(userId).stream()
                .map(PomodoroSoundResponse::fromMetadata)
                .toList();
    }

    @Transactional
    public PomodoroSoundResponse upload(String userId, MultipartFile file) {
        validateFile(file);
        if (soundRepository.countByUserId(userId) >= MAX_SOUNDS_PER_USER) {
            throw new IllegalArgumentException("You can store up to 10 Pomodoro sounds.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        String name = cleanFileName(file.getOriginalFilename());
        String soundId = UUID.randomUUID().toString();
        String storagePath = soundId + ".mp3";
        Path target = storageDirectory.resolve(storagePath).normalize();
        Path temporaryFile = null;

        try {
            Files.createDirectories(storageDirectory);
            temporaryFile = Files.createTempFile(storageDirectory, soundId + "-", ".upload");
            try (InputStream input = file.getInputStream()) {
                Files.copy(input, temporaryFile, StandardCopyOption.REPLACE_EXISTING);
            }
            if (Files.size(temporaryFile) != file.getSize()) {
                throw new IOException("The uploaded sound size changed while it was being stored.");
            }
            try {
                Files.move(temporaryFile, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (java.nio.file.AtomicMoveNotSupportedException exception) {
                Files.move(temporaryFile, target);
            }

            PomodoroSound sound = new PomodoroSound(
                    soundId, user, name, "audio/mpeg", file.getSize(), null, storagePath);
            soundRepository.save(sound);
            log.info("Uploaded Pomodoro sound: userId={} soundId={} fileSize={}", userId, sound.getId(), file.getSize());
            return PomodoroSoundResponse.from(sound);
        } catch (IOException | RuntimeException exception) {
            deleteQuietly(temporaryFile);
            deleteQuietly(target);
            if (exception instanceof IllegalArgumentException argumentException) throw argumentException;
            throw new IllegalArgumentException("The sound file could not be stored.", exception);
        }
    }

    @Transactional(readOnly = true)
    public PomodoroSound getSound(String soundId, String userId) {
        return soundRepository.findByIdAndUserId(soundId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Pomodoro sound not found: " + soundId));
    }

    @Transactional(readOnly = true)
    public PomodoroSoundAudio getAudio(String soundId, String userId) {
        PomodoroSound sound = getSound(soundId, userId);
        Resource resource;
        if (sound.getStoragePath() != null) {
            Path path = storageDirectory.resolve(sound.getStoragePath()).normalize();
            if (!path.startsWith(storageDirectory)) {
                throw new IllegalStateException("Pomodoro sound storage path escaped its directory.");
            }
            resource = new FileSystemResource(path);
        } else {
            resource = new ByteArrayResource(sound.getAudioData());
        }
        if (!resource.exists()) {
            throw new ResourceNotFoundException("Pomodoro sound file not found: " + soundId);
        }
        return new PomodoroSoundAudio(sound.getName(), sound.getContentType(), sound.getFileSize(), resource);
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
        if (sound.getStoragePath() != null) {
            deleteQuietly(storageDirectory.resolve(sound.getStoragePath()).normalize());
        }
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

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("Could not remove Pomodoro sound file {}", path, exception);
        }
    }

    public record PomodoroSoundResponse(String id, String name, long fileSize) {
        static PomodoroSoundResponse from(PomodoroSound sound) {
            return new PomodoroSoundResponse(sound.getId(), sound.getName(), sound.getFileSize());
        }

        static PomodoroSoundResponse fromMetadata(PomodoroSoundMetadata sound) {
            return new PomodoroSoundResponse(sound.id(), sound.name(), sound.fileSize());
        }
    }

    public record PomodoroSoundAudio(String name, String contentType, long fileSize, Resource resource) {
    }
}
