package org.osama.day;

import lombok.Data;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/day")
@CrossOrigin("*")
public class DayController {
    private final DayService dayService;

    public DayController(DayService dayService) {
        this.dayService = dayService;
    }

    @GetMapping("/get-today")
    public DayEntity getToday() {
        return dayService.getToday();
    }
    @PostMapping("/set-today-info")
    public void setTodayInfo(@RequestBody DayRequest dayRequest) {
        dayService.setTodayInfo(dayRequest.dayRating, dayRequest.dayPlan, dayRequest.daySummary);
    }
    @PostMapping("/set-day-rating/{date}/{rating}")
    public void setDayRating(@PathVariable String date, @PathVariable double rating) {
        dayService.setDayRating(date, rating);
    }
    @PostMapping("/set-today-rating/{rating}")
    public void setTodayRating(@PathVariable double rating) {
        dayService.setTodayRating(rating);
    }
    @PostMapping("/set-day-summary")
    public void setDaySummary(@RequestBody DayRequest daySummaryRequest) {
        dayService.setDaySummary(daySummaryRequest.dayDate, daySummaryRequest.daySummary);
    }
    @PostMapping("/set-day-plan")
    public void setDayPlan(@RequestBody DayRequest dayPlanRequest) {
        dayService.setDayPlan(dayPlanRequest.dayDate, dayPlanRequest.dayPlan);
    }
    @GetMapping("/get-day-plan/{date}")
    public String getDayPlan(@PathVariable String date) {
        return dayService.getDayPlan(date);
    }
    @GetMapping("/get-day-summary/{date}")
    public String getDaySummary(@PathVariable String date) {
        return dayService.getDaySummary(date);
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
