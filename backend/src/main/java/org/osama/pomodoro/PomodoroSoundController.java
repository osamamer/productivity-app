package org.osama.pomodoro;

import lombok.RequiredArgsConstructor;
import org.osama.user.CurrentUserService;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/users/me/pomodoro-sounds")
@RequiredArgsConstructor
public class PomodoroSoundController {
    private final CurrentUserService currentUserService;
    private final PomodoroSoundService soundService;

    @GetMapping
    public List<PomodoroSoundService.PomodoroSoundResponse> getSounds() {
        return soundService.getSounds(currentUserService.getCurrentUserId());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PomodoroSoundService.PomodoroSoundResponse upload(@RequestParam("file") MultipartFile file) {
        return soundService.upload(currentUserService.getCurrentUserId(), file);
    }

    @GetMapping("/{soundId}/audio")
    public ResponseEntity<ByteArrayResource> getAudio(@PathVariable String soundId) {
        PomodoroSound sound = soundService.getSound(soundId, currentUserService.getCurrentUserId());
        ByteArrayResource resource = new ByteArrayResource(sound.getAudioData());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(sound.getContentType()))
                .contentLength(sound.getFileSize())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(sound.getName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(resource);
    }

    @DeleteMapping("/{soundId}")
    public ResponseEntity<Void> delete(@PathVariable String soundId) {
        soundService.delete(soundId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
