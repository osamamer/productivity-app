package org.osama.mentalthread;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MentalThreadLoadEntryRepository extends JpaRepository<MentalThreadLoadEntry, String> {
    List<MentalThreadLoadEntry> findAllByMentalThreadIdOrderByRecordedAtAsc(String threadId);

    void deleteAllByMentalThreadId(String threadId);
}
