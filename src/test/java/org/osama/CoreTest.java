package org.osama;

import org.junit.jupiter.api.Test;
import org.osama.task.ListTaskRepository;
import org.osama.task.Task;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class CoreTest {
    @Test
    void test() {
        ListTaskRepository listTaskRepository = new ListTaskRepository();
        Task write = Task.createNewTask("Write", "500 words");
        listTaskRepository.add(write);
        Task read = Task.createNewTask("Read", "500 words");
        listTaskRepository.add(read);
        Task rewrite = Task.createNewTask("Rewrite", "500 words");
        listTaskRepository.add(rewrite);
        assertEquals(3, listTaskRepository.getAll().size());
        listTaskRepository.remove(read.getTaskId());
        assertEquals(2, listTaskRepository.getAll().size());
        assertThrows(IllegalArgumentException.class, () -> listTaskRepository.remove("1234"));
    }
}
