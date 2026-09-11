package org.osama.day;

import java.time.LocalDate;

public record DayCalendarResponse(
        LocalDate date,
        String appliedTemplateId,
        String appliedTemplateName
) {
}
