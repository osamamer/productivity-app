package org.osama;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(Controller.class)
public class ControllerIT {

    @Autowired
    private MockMvc mockMvc;
    @MockBean
    private TaskRepository taskRepository;

    @Test
    void test() throws Exception {
        mockMvc.perform(get("/api/v1/task")).andExpect(status().isOk());
    }

}
