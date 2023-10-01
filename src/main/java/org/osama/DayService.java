package org.osama;

import org.springframework.stereotype.Service;

@Service
public class DayService {
    private final TaskRepository taskRepository;

    public DayService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }




}
