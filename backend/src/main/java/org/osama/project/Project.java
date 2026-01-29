package org.osama.project;

import jakarta.persistence.*;
import lombok.Data;
import org.osama.user.User;

import java.time.LocalDateTime;

@Data
@Entity
public class Project {
    @Column(nullable = false)
    @Id
    private String projectId;

    @Column(nullable = false)
    private LocalDateTime creationDateTime;

    @Column(nullable = false)
    private String name;

    @Column
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;

}
