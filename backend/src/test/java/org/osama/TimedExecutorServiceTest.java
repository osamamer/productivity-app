package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.scheduling.JobType;
import org.osama.scheduling.TimedExecutorService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
public class TimedExecutorServiceTest {


    @Autowired
    private TimedExecutorService timedExecutorService;


    @Test
    void canHandleAllJobTypes() {

        List<JobType> allJobTypes = Arrays.stream(JobType.values()).toList();
        assertTrue(timedExecutorService.getJobMap().keySet().containsAll(allJobTypes));

    }

}
