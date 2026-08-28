package org.osama.taskgroup;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/task-groups")
public class TaskGroupController {
    private final TaskGroupService groupService;
    private final CurrentUserService currentUserService;

    public TaskGroupController(TaskGroupService groupService, CurrentUserService currentUserService) {
        this.groupService = groupService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<TaskGroupResponse> getGroups() {
        return groupService.getGroups(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<TaskGroupResponse> createGroup(@RequestBody TaskGroupRequest request) {
        return ResponseEntity.ok(groupService.createGroup(request.getName(), request.getTaskIds(),
                currentUserService.getCurrentUserId()));
    }

    @PatchMapping("/{groupId}")
    public TaskGroupResponse renameGroup(@PathVariable String groupId, @RequestBody TaskGroupRequest request) {
        return groupService.renameGroup(groupId, request.getName(), currentUserService.getCurrentUserId());
    }

    @PutMapping("/{groupId}/tasks")
    public TaskGroupResponse replaceTasks(@PathVariable String groupId, @RequestBody TaskGroupRequest request) {
        return groupService.replaceTasks(groupId, request.getTaskIds(), currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupId) {
        groupService.deleteGroup(groupId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
