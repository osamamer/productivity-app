package org.osama.project;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {
    private final CurrentUserService currentUserService;
    private final ProjectService projectService;

    public ProjectController(CurrentUserService currentUserService, ProjectService projectService) {
        this.currentUserService = currentUserService;
        this.projectService = projectService;
    }

    @GetMapping
    public List<ProjectResponse> getProjects() {
        return projectService.getProjects(currentUserService.getCurrentUserId());
    }

    @GetMapping("/{projectId}")
    public ProjectResponse getProject(@PathVariable String projectId) {
        return projectService.getProject(projectId, currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(@RequestBody CreateProjectRequest request) {
        ProjectResponse project = projectService.createProject(request, currentUserService.getCurrentUserId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(project.projectId())
                .toUri();
        return ResponseEntity.created(location).body(project);
    }

    @PatchMapping("/{projectId}")
    public ProjectResponse updateProject(@PathVariable String projectId, @RequestBody UpdateProjectRequest request) {
        return projectService.updateProject(projectId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(@PathVariable String projectId) {
        projectService.deleteProject(projectId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
