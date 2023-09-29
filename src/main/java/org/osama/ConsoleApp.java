package org.osama;

import java.util.Scanner;

public class ConsoleApp {
    final static ListTaskRepository listTaskRepository = new ListTaskRepository();
    final static Scanner scanner = new Scanner(System.in);

    public static void main(String[] args) {
        System.out.println("Welcome to Productivity App!");
        //noinspection ConditionalBreakInInfiniteLoop
        while (true) {
            String taskNameInput = getNameInput();
            String taskDiscInput = getDescriptionInput();
            listTaskRepository.add(Task.createNewTask(taskNameInput, taskDiscInput));
            printAllTasks();
            System.out.println("Quit? [Y/N]");
            if (scanner.nextLine().equals("Y")) break;
        }
    }

    private static String getDescriptionInput() {
        return getInput("Please enter a description for your so-named task if it can so be named: ");
    }

    private static String getNameInput() {
        return getInput("Please enter a task name: ");
    }

    private static String getInput(String prompt) {
        System.out.println(prompt);
        return scanner.nextLine();
    }

    private static void printAllTasks() {
        for (Task task :
                listTaskRepository.getAll()) {
            System.out.printf("Task ID [%s] | Task name [%s] | Task Description [%s]%n",
                    task.getTaskId(), task.getName(), task.getDescription());
        }
    }
}