import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.TimeZone;

@RestController
@RequestMapping("/debug")
@CrossOrigin("*")

public class TimeController {
    @GetMapping("/time")
    public Map<String, String> getTime() {
        Map<String, String> times = new HashMap<>();
        times.put("system", new Date().toString());
        times.put("instant", Instant.now().toString());
        times.put("zoned", ZonedDateTime.now(ZoneId.of("Asia/Amman")).toString());
        times.put("systemTimeMillis", String.valueOf(System.currentTimeMillis()));
        times.put("timeZone", TimeZone.getDefault().getID());
        times.put("isDST", String.valueOf(TimeZone.getDefault().inDaylightTime(new Date())));
        return times;
    }
}