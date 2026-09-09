package org.osama.daytemplate;

import org.osama.user.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/day-templates")
public class DayTemplateController {
    private final DayTemplateService templateService;
    private final CurrentUserService currentUserService;

    public DayTemplateController(DayTemplateService templateService, CurrentUserService currentUserService) {
        this.templateService = templateService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<DayTemplateResponse> getTemplates() {
        return templateService.getTemplates(currentUserService.getCurrentUserId());
    }

    @GetMapping("/{templateId}")
    public DayTemplateResponse getTemplate(@PathVariable String templateId) {
        return templateService.getTemplate(templateId, currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<DayTemplateResponse> createTemplate(@RequestBody DayTemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(templateService.createTemplate(request, currentUserService.getCurrentUserId()));
    }

    @PutMapping("/{templateId}")
    public DayTemplateResponse updateTemplate(@PathVariable String templateId,
                                              @RequestBody DayTemplateRequest request) {
        return templateService.updateTemplate(templateId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{templateId}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable String templateId) {
        templateService.deleteTemplate(templateId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{templateId}/apply")
    public DayTemplateApplicationResponse applyTemplate(@PathVariable String templateId,
                                                        @RequestBody ApplyDayTemplateRequest request) {
        return templateService.applyTemplate(templateId, request == null ? null : request.date(),
                currentUserService.getCurrentUserId());
    }
}
