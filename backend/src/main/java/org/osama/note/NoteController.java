package org.osama.note;

import org.osama.user.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/v1/notes")
public class NoteController {
    private final CurrentUserService currentUserService;
    private final NoteService noteService;

    public NoteController(CurrentUserService currentUserService, NoteService noteService) {
        this.currentUserService = currentUserService;
        this.noteService = noteService;
    }

    @GetMapping
    public List<NoteResponse> getNotes() {
        return noteService.getNotes(currentUserService.getCurrentUserId());
    }

    @GetMapping("/{noteId}")
    public NoteResponse getNote(@PathVariable String noteId) {
        return noteService.getNote(noteId, currentUserService.getCurrentUserId());
    }

    @PostMapping
    public ResponseEntity<NoteResponse> createNote(@RequestBody CreateNoteRequest request) {
        NoteResponse note = noteService.createNote(request, currentUserService.getCurrentUserId());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(note.id())
                .toUri();
        return ResponseEntity.created(location).body(note);
    }

    @PatchMapping("/{noteId}")
    public NoteResponse updateNote(@PathVariable String noteId, @RequestBody UpdateNoteRequest request) {
        return noteService.updateNote(noteId, request, currentUserService.getCurrentUserId());
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<Void> deleteNote(@PathVariable String noteId) {
        noteService.deleteNote(noteId, currentUserService.getCurrentUserId());
        return ResponseEntity.noContent().build();
    }
}
