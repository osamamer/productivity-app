package org.osama.stat;

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
@RequestMapping("/api/v1/stats/groups")
public class StatGroupController {
    private final StatGroupService groupService;
    private final CurrentUserService currentUserService;

    public StatGroupController(StatGroupService groupService, CurrentUserService currentUserService) {
        this.groupService = groupService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<StatGroupResponse> getGroups() {
        return groupService.getGroups(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public StatGroupResponse createGroup(@RequestBody StatGroupRequest request) {
        return groupService.createGroup(request.getName(), request.getStatDefinitionIds(),
                currentUserService.getCurrentUserId());
    }

    @PutMapping("/order")
    public List<StatGroupResponse> reorderGroups(@RequestBody StatGroupOrderRequest request) {
        return groupService.reorderGroups(request.getGroupIds(), currentUserService.getCurrentUserId());
    }

    @PatchMapping("/{groupId}")
    public StatGroupResponse renameGroup(@PathVariable String groupId,
                                         @RequestBody StatGroupRequest request) {
        return groupService.renameGroup(groupId, request.getName(), currentUserService.getCurrentUserId());
    }

    @PutMapping("/{groupId}/definitions")
    public StatGroupResponse replaceDefinitions(@PathVariable String groupId,
                                                @RequestBody StatGroupRequest request) {
        return groupService.replaceDefinitions(groupId, request.getStatDefinitionIds(),
                currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupId) {
        groupService.deleteGroup(groupId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
