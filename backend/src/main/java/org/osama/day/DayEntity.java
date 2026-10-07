package org.osama.day;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.osama.user.User;

import java.time.LocalDate;
@Data
@NoArgsConstructor
@org.hibernate.annotations.SQLDelete(sql = "UPDATE day_entity SET soft_deleted = true WHERE id = ?")
@org.hibernate.annotations.Where(clause = "soft_deleted = false")
@Entity
public class DayEntity {
    @Column(name = "soft_deleted", nullable = false)
    private boolean softDeleted;

    @Id
    private String id;
    @Column
    private double rating;
    @Column
    private String plan;
    @Column
    private String summary;
    @Column(name = "applied_template_id", length = 36)
    private String appliedTemplateId;
    @Column(name = "applied_template_name", length = 120)
    private String appliedTemplateName;
    @Column
    @JsonSerialize(using = LocalDateSerializer.class)
    @JsonDeserialize(using = LocalDateDeserializer.class)
    private LocalDate localDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private String userId;
}
