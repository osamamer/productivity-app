package org.osama.mentalstate;

import org.osama.user.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/v1/mental-state")
public class MentalStateController {

    private final MentalStateService mentalStateService;
    private final CurrentUserService currentUserService;

    public MentalStateController(MentalStateService mentalStateService,
                                 CurrentUserService currentUserService) {
        this.mentalStateService = mentalStateService;
        this.currentUserService = currentUserService;
    }

    @PostMapping("/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    public MentalStateCheckInResponse checkIn(@Valid @RequestBody CreateMentalStateCheckInRequest request) {
        return mentalStateService.checkIn(request, currentUserService.getCurrentUserId());
    }

    @GetMapping("/check-ins")
    public List<MentalStateCheckInResponse> getHistory(
            @RequestParam(defaultValue = "30") int limit) {
        return mentalStateService.getHistory(currentUserService.getCurrentUserId(), limit);
    }
}
