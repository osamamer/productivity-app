package org.osama;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class MainTest {
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
        listTaskRepository.remove(read.getTaskID());
        assertEquals(2, listTaskRepository.getAll().size());
        assertThrows(IllegalArgumentException.class, () -> listTaskRepository.remove("1234"));
    }
}
