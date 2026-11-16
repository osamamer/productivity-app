package org.osama.backup;

import lombok.RequiredArgsConstructor;
import org.osama.user.CurrentUserService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me/backup")
@RequiredArgsConstructor
public class BackupController {
    private final CurrentUserService currentUserService;
    private final BackupService backupService;

    @GetMapping
    public ResponseEntity<BackupService.Snapshot> capture() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(backupService.capture(currentUserService.getCurrentUserId()));
    }
}
