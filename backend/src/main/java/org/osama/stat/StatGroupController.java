package org.osama.stat;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/stats/groups")
public class StatGroupController {
    private final StatGroupService groupService;
    private final CurrentUserService currentUserService;
    private final StatService statService;
    private final SecretStatsAccessService secretStatsAccessService;

    public StatGroupController(StatGroupService groupService, CurrentUserService currentUserService,
                               StatService statService, SecretStatsAccessService secretStatsAccessService) {
        this.groupService = groupService;
        this.currentUserService = currentUserService;
        this.statService = statService;
        this.secretStatsAccessService = secretStatsAccessService;
    }

    @GetMapping
    public List<StatGroupResponse> getGroups(
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return visibleGroups(groupService.getGroups(userId), userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @PostMapping
    public StatGroupResponse createGroup(@RequestBody StatGroupRequest request,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        boolean includeSecret = secretStatsAccessService.hasAccess(userId, accessToken);
        return visibleGroup(groupService.createGroup(request.getName(), request.getStatDefinitionIds(),
                userId, includeSecret), userId, includeSecret);
    }

    @PutMapping("/order")
    public List<StatGroupResponse> reorderGroups(@RequestBody StatGroupOrderRequest request,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return visibleGroups(groupService.reorderGroups(request.getGroupIds(), userId), userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @PatchMapping("/{groupId}")
    public StatGroupResponse renameGroup(@PathVariable String groupId,
                                         @RequestBody StatGroupRequest request,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        return visibleGroup(groupService.renameGroup(groupId, request.getName(), userId), userId,
                secretStatsAccessService.hasAccess(userId, accessToken));
    }

    @PutMapping("/{groupId}/definitions")
    public StatGroupResponse replaceDefinitions(@PathVariable String groupId,
                                                @RequestBody StatGroupRequest request,
            @RequestHeader(value = "X-Secret-Stats-Access", required = false) String accessToken) {
        String userId = currentUserService.getCurrentUserId();
        boolean includeSecret = secretStatsAccessService.hasAccess(userId, accessToken);
        return visibleGroup(groupService.replaceDefinitions(groupId, request.getStatDefinitionIds(),
                userId, includeSecret), userId, includeSecret);
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(@PathVariable String groupId) {
        groupService.deleteGroup(groupId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }

    private List<StatGroupResponse> visibleGroups(List<StatGroupResponse> groups, String userId,
                                                   boolean includeSecret) {
        if (includeSecret) return groups;
        var secretIds = statService.getDefinitions(userId, true).stream()
                .filter(StatDefinition::isSecret)
                .map(StatDefinition::getId)
                .collect(java.util.stream.Collectors.toSet());
        return groups.stream().map(group -> visibleGroup(group, secretIds)).toList();
    }

    private StatGroupResponse visibleGroup(StatGroupResponse group, String userId, boolean includeSecret) {
        if (includeSecret) return group;
        var secretIds = statService.getDefinitions(userId, true).stream()
                .filter(StatDefinition::isSecret)
                .map(StatDefinition::getId)
                .collect(java.util.stream.Collectors.toSet());
        return visibleGroup(group, secretIds);
    }

    private StatGroupResponse visibleGroup(StatGroupResponse group, java.util.Set<String> secretIds) {
        return new StatGroupResponse(group.groupId(), group.name(),
                group.statDefinitionIds().stream().filter(id -> !secretIds.contains(id)).toList(),
                group.displayOrder());
    }
}
