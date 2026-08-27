package org.osama.note;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/note-categories")
public class NoteCategoryController {
    private final NoteCategoryService categoryService;
    private final CurrentUserService currentUserService;

    public NoteCategoryController(NoteCategoryService categoryService, CurrentUserService currentUserService) {
        this.categoryService = categoryService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<NoteCategoryResponse> getCategories() {
        return categoryService.getCategories(currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<NoteCategoryResponse> createCategory(@RequestBody NoteCategoryRequest request) {
        NoteCategoryResponse category = categoryService.createCategory(
                request,
                currentUserService.getCurrentUserId()
        );
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(category.id())
                .toUri();
        return ResponseEntity.created(location).body(category);
    }

    @PatchMapping("/{categoryId}")
    public NoteCategoryResponse updateCategory(
            @PathVariable String categoryId,
            @RequestBody NoteCategoryRequest request
    ) {
        return categoryService.updateCategory(categoryId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{categoryId}")
    public ResponseEntity<Void> deleteCategory(@PathVariable String categoryId) {
        categoryService.deleteCategory(categoryId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
