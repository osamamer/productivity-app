package org.osama.day;

import lombok.Data;
import org.osama.user.CurrentUserService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/day")
public class DayController {
    private final DayService dayService;
    private final CurrentUserService currentUserService;

    public DayController(DayService dayService, CurrentUserService currentUserService) {
        this.dayService = dayService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/get-today")
    public DayEntity getToday() {
        return dayService.getToday(currentUserService.getCurrentUserId());
    }

    @PostMapping("/set-today-info")
    public void setTodayInfo(@RequestBody DayRequest dayRequest) {
        dayService.setTodayInfo(dayRequest.dayRating, dayRequest.dayPlan, dayRequest.daySummary, currentUserService.getCurrentUserId());
    }

    @PostMapping("/set-day-rating/{date}/{rating}")
    public void setDayRating(@PathVariable String date, @PathVariable double rating) {
        dayService.setDayRating(date, rating, currentUserService.getCurrentUserId());
    }

    @PostMapping("/set-today-rating/{rating}")
    public void setTodayRating(@PathVariable double rating) {
        dayService.setTodayRating(rating, currentUserService.getCurrentUserId());
    }

    @PostMapping("/set-day-summary")
    public void setDaySummary(@RequestBody DayRequest daySummaryRequest) {
        dayService.setDaySummary(daySummaryRequest.dayDate, daySummaryRequest.daySummary, currentUserService.getCurrentUserId());
    }

    @PostMapping("/set-day-plan")
    public void setDayPlan(@RequestBody DayRequest dayPlanRequest) {
        dayService.setDayPlan(dayPlanRequest.dayDate, dayPlanRequest.dayPlan, currentUserService.getCurrentUserId());
    }

    @GetMapping("/get-day-plan/{date}")
    public String getDayPlan(@PathVariable String date) {
        return dayService.getDayPlan(date, currentUserService.getCurrentUserId());
    }

    @GetMapping("/get-day-summary/{date}")
    public String getDaySummary(@PathVariable String date) {
        return dayService.getDaySummary(date, currentUserService.getCurrentUserId());
    }

    @Data
    public static class DayRequest {
        String dayDate;
        String dayId;
        double dayRating;
        String dayPlan;
        String daySummary;
    }
}
