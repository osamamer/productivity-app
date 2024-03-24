package org.osama.task;

import java.util.Timer;
import java.util.TimerTask;
import java.util.Scanner;

 class Main {
    private static Timer timer;
    private static TimerTask focusTask;
    private static TimerTask breakTask;
    private static int currentFocus = 0;

    public static void main(String[] args) {
        int focusDuration = 25; // in minutes
        int focuses = 4;
        int breakDuration = 5; // in minutes
        String taskId = "Work on Java project";

        startPomodoroTimer(taskId, focusDuration, focuses, breakDuration);
    }

    public static void startPomodoroTimer(final String taskId, final int focusDuration, final int focuses, final int breakDuration) {
        timer = new Timer();

        System.out.println("Pomodoro Timer started for task: " + taskId);

        focusTask = new TimerTask() {
            @Override
            public void run() {
                System.out.println("Focus " + (currentFocus + 1) + " started. Duration: " + focusDuration + " minutes.");
                timer.schedule(new TimerTask() {
                    @Override
                    public void run() {
                        System.out.println("Focus " + (currentFocus + 1) + " completed.");
                        currentFocus++;
                        if (currentFocus < focuses) {
                            scheduleBreak();
                        } else {
                            System.out.println("All focuses completed. Task accomplished!");
                            timer.cancel();
                        }
                    }
                }, focusDuration * 60 * 1000); // converting minutes to milliseconds
            }
        };

        breakTask = new TimerTask() {
            @Override
            public void run() {
                System.out.println("Take a break for " + breakDuration + " minutes.");
                timer.schedule(focusTask, breakDuration * 60 * 1000); // converting minutes to milliseconds
            }
        };

        focusTask.run();

        // Initial focus is started immediately, after that breaks and focuses are alternated by timer tasks
        scheduleBreak();

        // Allow user to pause and resume the timer
        Scanner scanner = new Scanner(System.in);
        while (true) {
            System.out.println("Enter 'pause' to pause the timer or 'resume' to resume it:");
            String input = scanner.nextLine().trim();
            if (input.equalsIgnoreCase("pause")) {
                pauseTimer();
            } else if (input.equalsIgnoreCase("resume")) {
                resumeTimer();
            } else {
                System.out.println("Invalid input. Please try again.");
            }
        }
    }

    public static void pauseTimer() {
        System.out.println("Timer paused.");
        focusTask.cancel();
        breakTask.cancel();
    }

    public static void resumeTimer() {
        System.out.println("Timer resumed.");
        focusTask = new TimerTask() {
            @Override
            public void run() {
                System.out.println("Focus " + (currentFocus + 1) + " resumed. Duration: " + focusTask.scheduledExecutionTime() + " minutes left.");
                timer.schedule(new TimerTask() {
                    @Override
                    public void run() {
                        System.out.println("Focus " + (currentFocus + 1) + " completed.");
                        currentFocus++;
                        if (currentFocus < 4) {
                            scheduleBreak();
                        } else {
                            System.out.println("All focuses completed. Task accomplished!");
                            timer.cancel();
                        }
                    }
                }, focusTask.scheduledExecutionTime()); // using the remaining time for the resumed focus
            }
        };
        breakTask = new TimerTask() {
            @Override
            public void run() {
                System.out.println("Take a break for " + breakTask.scheduledExecutionTime() + " minutes.");
                timer.schedule(focusTask, breakTask.scheduledExecutionTime() * 60 * 1000); // converting minutes to milliseconds
            }
        };
        timer.schedule(breakTask, 1000); // initial delay of 1 second before starting the break
    }
    static void scheduleBreak() {
        timer.schedule(breakTask, 1000); // initial delay of 1 second before starting the break
    }
}

