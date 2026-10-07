import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOptimisticCompletedPomodoroStatus,
  createOptimisticPomodoroStatus,
  getOptimisticPomodoroStatus,
  pomodoroDurationInSeconds,
} from '../src/services/utils/optimisticPomodoro.ts';

const form = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  numFocuses: 4,
  longBreakCooldown: 4,
};

function status(overrides = {}) {
  return {
    pomodoroId: 'pomodoro-1',
    associatedTaskId: 'task-1',
    active: true,
    sessionActive: true,
    sessionRunning: true,
    secondsPassedInSession: 125,
    secondsUntilNextTransition: 300,
    currentFocusNumber: 2,
    numFocuses: 4,
    completedFocusSessions: 1,
    totalFocusSeconds: 900,
    phase: 'FOCUS',
    ...overrides,
  };
}

test('converts configured minutes or seconds and clamps negative durations', () => {
  assert.equal(pomodoroDurationInSeconds(1.5, false), 90);
  assert.equal(pomodoroDurationInSeconds(1.5, true), 2);
  assert.equal(pomodoroDurationInSeconds(-2, false), 0);
});

test('starting a break records the focus time and chooses the short break', () => {
  const next = getOptimisticPomodoroStatus(status(), 'start-break', form, false);

  assert.equal(next.phase, 'BREAK');
  assert.equal(next.sessionActive, false);
  assert.equal(next.sessionRunning, false);
  assert.equal(next.secondsUntilNextTransition, 5 * 60);
  assert.equal(next.completedFocusSessions, 2);
  assert.equal(next.totalFocusSeconds, 1025);
});

test('starting the cooldown focus break chooses the configured long break', () => {
  const next = getOptimisticPomodoroStatus(
    status({ currentFocusNumber: 4, numFocuses: 6 }),
    'start-break',
    form,
    false,
  );

  assert.equal(next.secondsUntilNextTransition, 15 * 60);
});

test('finishing a break starts the next focus without exceeding the configured count', () => {
  const next = getOptimisticPomodoroStatus(
    status({
      phase: 'BREAK',
      sessionActive: false,
      sessionRunning: false,
      currentFocusNumber: 4,
      numFocuses: 4,
    }),
    'finish-break',
    form,
    false,
  );

  assert.equal(next.phase, 'FOCUS');
  assert.equal(next.sessionActive, true);
  assert.equal(next.sessionRunning, true);
  assert.equal(next.secondsPassedInSession, 0);
  assert.equal(next.secondsUntilNextTransition, 25 * 60);
  assert.equal(next.currentFocusNumber, 4);
});

test('ignores actions that are invalid for the current Pomodoro phase', () => {
  assert.equal(getOptimisticPomodoroStatus(status({ active: false }), 'toggle', form, false), null);
  assert.equal(getOptimisticPomodoroStatus(status(), 'finish-break', form, false), null);
  assert.equal(
    getOptimisticPomodoroStatus(status({ currentFocusNumber: 4 }), 'start-break', form, false),
    null,
  );
});

test('completing a running focus includes its elapsed time exactly once', () => {
  const next = createOptimisticCompletedPomodoroStatus(status());

  assert.equal(next.active, false);
  assert.equal(next.phase, 'COMPLETED');
  assert.equal(next.secondsUntilNextTransition, 0);
  assert.equal(next.completedFocusSessions, 2);
  assert.equal(next.totalFocusSeconds, 1025);
});

test('creates an active first focus with a task association and no elapsed time', () => {
  const next = createOptimisticPomodoroStatus('task-7', form, false);

  assert.match(next.pomodoroId, /^optimistic-pomodoro-/);
  assert.equal(next.associatedTaskId, 'task-7');
  assert.equal(next.active, true);
  assert.equal(next.phase, 'FOCUS');
  assert.equal(next.currentFocusNumber, 1);
  assert.equal(next.secondsUntilNextTransition, 25 * 60);
  assert.equal(next.totalFocusSeconds, 0);
});

test('toggle pauses and resumes without changing the current focus progress', () => {
  const running = status({ secondsPassedInSession: 61, secondsUntilNextTransition: 1_439 });
  const paused = getOptimisticPomodoroStatus(running, 'toggle', form, false);
  const resumed = getOptimisticPomodoroStatus(paused, 'toggle', form, false);

  assert.equal(paused.sessionRunning, false);
  assert.equal(paused.sessionActive, true);
  assert.equal(paused.secondsPassedInSession, 61);
  assert.equal(resumed.sessionRunning, true);
  assert.equal(resumed.secondsUntilNextTransition, 1_439);
});

test('a waiting break enters the correct break phase and uses the cooldown duration', () => {
  const next = getOptimisticPomodoroStatus(
    status({ phase: 'WAITING_FOR_BREAK', currentFocusNumber: 4, numFocuses: 6 }),
    'toggle',
    form,
    false,
  );

  assert.equal(next.phase, 'BREAK');
  assert.equal(next.sessionActive, false);
  assert.equal(next.sessionRunning, false);
  assert.equal(next.secondsUntilNextTransition, 15 * 60);
});

test('a waiting focus starts the next focus and resets elapsed time', () => {
  const next = getOptimisticPomodoroStatus(
    status({
      phase: 'WAITING_FOR_FOCUS',
      sessionActive: false,
      sessionRunning: false,
      currentFocusNumber: 2,
      secondsPassedInSession: 4,
    }),
    'toggle',
    form,
    true,
  );

  assert.equal(next.phase, 'FOCUS');
  assert.equal(next.sessionRunning, true);
  assert.equal(next.currentFocusNumber, 3);
  assert.equal(next.secondsPassedInSession, 0);
  assert.equal(next.secondsUntilNextTransition, 25);
});

test('completing a paused break does not count break time as focus time', () => {
  const next = createOptimisticCompletedPomodoroStatus(status({
    phase: 'BREAK',
    sessionActive: false,
    sessionRunning: false,
    secondsPassedInSession: 300,
    completedFocusSessions: 2,
    totalFocusSeconds: 1_500,
  }));

  assert.equal(next.completedFocusSessions, 2);
  assert.equal(next.totalFocusSeconds, 1_500);
  assert.equal(next.secondsPassedInSession, 0);
});
