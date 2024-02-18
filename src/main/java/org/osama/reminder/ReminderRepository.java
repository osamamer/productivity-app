package org.osama.reminder;

import org.osama.session.Session;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReminderRepository extends JpaRepository<Reminder, String> {

}
