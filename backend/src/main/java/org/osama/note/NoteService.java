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
import java.util.Collection;
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
        String title = request.title() == null || request.title().isBlank()
                ? ""
                : resolveTitle(request.title(), userId);
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

    @Transactional
    public List<NoteResponse> updateNotes(BulkNoteRequest request, String userId) {
        List<Note> notes = findOwnedNotes(request.getNoteIds(), userId);
        if (request.getPinned() == null && !request.isCategoryIdPresent()) {
            throw new InvalidParameterException("A bulk note update must include a change.");
        }

        NoteCategory category = request.isCategoryIdPresent() && request.getCategoryId() != null
                ? findOwnedCategory(request.getCategoryId(), userId)
                : null;
        for (Note note : notes) {
            if (request.getPinned() != null) note.setPinned(request.getPinned());
            if (request.isCategoryIdPresent()) note.setCategory(category);
        }
        noteRepository.saveAll(notes);
        log.info("Updated notes in bulk: userId={} noteCount={} fields={}",
                userId, notes.size(), changedFields(request));
        return notes.stream().map(NoteResponse::from).toList();
    }

    @Transactional
    public void deleteNotes(BulkNoteRequest request, String userId) {
        List<Note> notes = findOwnedNotes(request.getNoteIds(), userId);
        noteRepository.deleteAll(notes);
        log.info("Deleted notes in bulk: userId={} noteCount={}", userId, notes.size());
    }

    Note findOwnedNote(String noteId, String userId) {
        return noteRepository.findByIdAndUserId(noteId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note not found: " + noteId));
    }

    NoteCategory findOwnedCategory(String categoryId, String userId) {
        return categoryRepository.findByIdAndUserId(categoryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Note category not found: " + categoryId));
    }

    private List<Note> findOwnedNotes(Collection<String> noteIds, String userId) {
        if (noteIds == null || noteIds.isEmpty()
                || noteIds.stream().anyMatch(id -> id == null || id.isBlank())
                || noteIds.stream().distinct().count() != noteIds.size()) {
            throw new InvalidParameterException("At least one unique note id is required.");
        }

        List<Note> notes = noteRepository.findAllByIdInAndUserId(List.copyOf(noteIds), userId);
        if (notes.size() != noteIds.size()) {
            throw new ResourceNotFoundException("One or more notes were not found.");
        }
        return notes;
    }

    private List<String> changedFields(BulkNoteRequest request) {
        List<String> fields = new ArrayList<>();
        if (request.getPinned() != null) fields.add("pinned");
        if (request.isCategoryIdPresent()) fields.add("categoryId");
        return fields;
    }

    private String resolveTitle(String title, String userId) {
        validateTitle(title);

        if (title == null || title.isBlank() || UNTITLED_TITLE_PREFIX.equals(title)) {
            return UNTITLED_TITLE_PREFIX + " " + resolveUntitledNumber(userId);
        }
        return title;
    }

    private void validateTitle(String title) {
        if (title != null && title.length() > 255) {
            throw new InvalidParameterException("Title must contain no more than 255 characters.");
        }
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
