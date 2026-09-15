package org.osama.pomodoro;

import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.osama.user.User;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "pomodoro_sound")
@Getter
@NoArgsConstructor
public class PomodoroSound {

    @Id
    @Column(nullable = false, unique = true)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Basic(fetch = FetchType.LAZY)
    @JdbcTypeCode(SqlTypes.LONGVARBINARY)
    @Column(name = "audio_data", columnDefinition = "bytea")
    private byte[] audioData;

    /** New uploads live outside PostgreSQL so listing sounds never hydrates audio bytes. */
    @Column(name = "storage_path")
    private String storagePath;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public PomodoroSound(String id, User user, String name, String contentType,
                         long fileSize, byte[] audioData) {
        this(id, user, name, contentType, fileSize, audioData, null);
    }

    public PomodoroSound(String id, User user, String name, String contentType,
                         long fileSize, byte[] audioData, String storagePath) {
        this.id = id;
        this.user = user;
        this.name = name;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.audioData = audioData;
        this.storagePath = storagePath;
        this.createdAt = LocalDateTime.now();
    }
}
