package org.osama.note;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.safety.Safelist;
import org.osama.exceptions.ResourceNotFoundException;
import org.osama.user.User;
import org.osama.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.InvalidParameterException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.jsoup.Jsoup;

@Service
@Slf4j
public class NoteService {
    private static final String UNTITLED_TITLE_PREFIX = "Untitled";
    private static final Pattern UNTITLED_TITLE =
            Pattern.compile("^" + UNTITLED_TITLE_PREFIX + " (\\d+)$");
    private static final Safelist CONTENT_SAFELIST = Safelist.basic()
            .addTags("h1", "h2", "h3", "s");

    private final NoteRepository noteRepository;
    private final NoteCategoryRepository categoryRepository;
    private final UserRepository userRepository;

    public NoteService(NoteRepository noteRepository,
                       NoteCategoryRepository categoryRepository,
                       UserRepository userRepository) {
        this.noteRepository = noteRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotes(String userId) {
        return noteRepository.findAllByUserIdOrderByPinnedDescUpdatedAtDesc(userId).stream()
                .map(NoteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public NoteResponse getNote(String noteId, String userId) {
        return NoteResponse.from(findOwnedNote(noteId, userId));
    }

    @Transactional
    public NoteResponse createNote(CreateNoteRequest request, String userId) {
        String title = resolveTitle(request.title(), userId);
        String sanitizedContent = sanitizeContent(request.content());

        NoteCategory category = request.categoryId() == null
                ? null
                : findOwnedCategory(request.categoryId(), userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));

        Note note = Note.builder()
                .id(UUID.randomUUID().toString())
                .user(user)
                .title(title)
                .content(sanitizedContent)
                .pinned(request.pinned())
                .category(category)
                .build();
        noteRepository.save(note);
        log.info("Created note: userId={}, noteId={}", userId, note.getId());
        return NoteResponse.from(note);
    }

    @Transactional
    public NoteResponse updateNote(String noteId, UpdateNoteRequest request, String userId) {
        Note note = findOwnedNote(noteId, userId);
        List<String> changedFields = new ArrayList<>();

        if (request.getTitle() != null) {
            note.setTitle(resolveTitle(request.getTitle(), userId));
            changedFields.add("title");
        }

        if (request.getContent() != null) {
            note.setContent(sanitizeContent(request.getContent()));
            changedFields.add("content");
        }

        if (request.getPinned() != null) {
            note.setPinned(request.getPinned());
            changedFields.add("pinned");
        }

        if (request.isCategoryIdPresent()) {
            NoteCategory category = request.getCategoryId() == null
                    ? null
                    : findOwnedCategory(request.getCategoryId(), userId);

            note.setCategory(category);
            changedFields.add("categoryId");
        }

        noteRepository.save(note);
        if (!changedFields.isEmpty()) {
            log.info("Updated note: userId={}, noteId={}, fields={}", userId, noteId, changedFields);
        }
        return NoteResponse.from(note);
    }

    @Transactional
    public void deleteNote(String noteId, String userId) {
        Note note = findOwnedNote(noteId, userId);
        noteRepository.delete(note);
        log.info("Deleted note: userId={}, noteId={}", userId, noteId);
    }

    Note findOwnedNote(String noteId, String userId) {
        return noteRepository.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found: " + noteId));
    }

    NoteCategory findOwnedCategory(String categoryId, String userId) {
        return categoryRepository.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note category not found: " + categoryId));
    }

    private String resolveTitle(String title, String userId) {
        if (title != null && title.length() > 255) {
            throw new InvalidParameterException("Title must contain no more than 255 characters.");
        }

        if (title == null || title.isBlank() || UNTITLED_TITLE_PREFIX.equals(title)) {
            return UNTITLED_TITLE_PREFIX + " " + resolveUntitledNumber(userId);
        }
        return title;
    }

    private int resolveUntitledNumber(String userId) {
        // Titles are not identifiers, so simultaneous requests may legitimately reuse a suffix.
        int highestSuffix = noteRepository.findTitlesStartingWith(userId, UNTITLED_TITLE_PREFIX + " ")
                .stream()
                .map(UNTITLED_TITLE::matcher)
                .filter(Matcher::matches)
                .mapToInt(matcher -> Integer.parseInt(matcher.group(1)))
                .max()
                .orElse(0);
        return highestSuffix + 1;
    }

    private String sanitizeContent(String content) {
        return content == null ? "" : Jsoup.clean(content, CONTENT_SAFELIST);
    }
}
