package org.osama.note;

import lombok.extern.slf4j.Slf4j;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@Slf4j
public class NoteCategoryService {
    private static final int MAX_NAME_LENGTH = 80;
    private static final Pattern COLOR_PATTERN = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final NoteCategoryRepository categoryRepository;
    private final NoteRepository noteRepository;
    private final UserRepository userRepository;

    public NoteCategoryService(NoteCategoryRepository categoryRepository,
                               NoteRepository noteRepository,
                               UserRepository userRepository) {
        this.categoryRepository = categoryRepository;
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteCategoryResponse> getCategories(String userId) {
        return categoryRepository.findAllByUserIdOrderByNameAsc(userId).stream()
                .map(NoteCategoryResponse::from)
                .toList();
    }

    @Transactional
    public NoteCategoryResponse createCategory(NoteCategoryRequest request, String userId) {
        if (request == null) {
            throw new IllegalArgumentException("Category details are required.");
        }

        String name = validateName(request.name());
        String normalizedName = normalizeName(name);
        String color = validateColor(request.color());
        rejectDuplicateName(userId, normalizedName, null);

        NoteCategory category = new NoteCategory();
        category.setId(UUID.randomUUID().toString());
        category.setUser(userRepository.findUserById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userId)));
        category.setName(name);
        category.setNormalizedName(normalizedName);
        category.setColor(color);

        NoteCategory savedCategory = categoryRepository.save(category);
        log.info("Note category created: userId={} categoryId={}", userId, savedCategory.getId());
        return NoteCategoryResponse.from(savedCategory);
    }

    @Transactional
    public NoteCategoryResponse updateCategory(String categoryId, NoteCategoryRequest request, String userId) {
        if (request == null) {
            throw new IllegalArgumentException("Category details are required.");
        }

        NoteCategory category = findOwnedCategory(categoryId, userId);
        List<String> changedFields = new ArrayList<>();

        if (request.name() != null) {
            String name = validateName(request.name());
            String normalizedName = normalizeName(name);
            rejectDuplicateName(userId, normalizedName, categoryId);
            category.setName(name);
            category.setNormalizedName(normalizedName);
            changedFields.add("name");
        }
        if (request.color() != null) {
            category.setColor(validateColor(request.color()));
            changedFields.add("color");
        }

        if (changedFields.isEmpty()) {
            return NoteCategoryResponse.from(category);
        }

        NoteCategory savedCategory = categoryRepository.save(category);
        log.info("Note category updated: userId={} categoryId={} changedFields={}",
                userId, savedCategory.getId(), changedFields);
        return NoteCategoryResponse.from(savedCategory);
    }

    @Transactional
    public void deleteCategory(String categoryId, String userId) {
        NoteCategory category = findOwnedCategory(categoryId, userId);
        int uncategorizedNoteCount = noteRepository.clearCategoryAssignments(categoryId, userId);
        categoryRepository.delete(category);
        log.info("Note category deleted: userId={} categoryId={} uncategorizedNoteCount={}",
                userId, categoryId, uncategorizedNoteCount);
    }

    NoteCategory findOwnedCategory(String categoryId, String userId) {
        return categoryRepository.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note category not found: " + categoryId));
    }

    private String validateName(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            throw new IllegalArgumentException("Category name is required.");
        }
        String name = rawName.trim().replaceAll("\\s+", " ");
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Category name must be 80 characters or fewer.");
        }
        return name;
    }

    private String normalizeName(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    private String validateColor(String rawColor) {
        if (rawColor == null || !COLOR_PATTERN.matcher(rawColor).matches()) {
            throw new IllegalArgumentException("Category color must use #RRGGBB format.");
        }
        return rawColor.toUpperCase(Locale.ROOT);
    }

    private void rejectDuplicateName(String userId, String normalizedName, String currentCategoryId) {
        categoryRepository.findByUserIdAndNormalizedName(userId, normalizedName)
                .filter(category -> !category.getId().equals(currentCategoryId))
                .ifPresent(category -> {
                    throw new IllegalArgumentException("A category with that name already exists.");
                });
    }
}
