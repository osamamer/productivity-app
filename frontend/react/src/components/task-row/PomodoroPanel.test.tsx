import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PomodoroProvider } from '../../contexts/PomodoroContext';
import { createFakeBackend } from '../../test/fakeBackend';
import { server } from '../../test/server';
import type { PomodoroStatus } from '../../types/PomodoroStatus';
import { PomodoroCompleteSummary } from './PomodoroCompleteSummary';
import { PomodoroRunningControls } from './PomodoroRunningControls';
import { PomodoroSetupForm } from './PomodoroSetupForm';

// The white noise control reads Pomodoro preferences, which load from the API.
beforeEach(() => server.use(...createFakeBackend({ today: '2026-11-26' }).handlers));

function status(overrides: Partial<PomodoroStatus> = {}): PomodoroStatus {
    return {
        pomodoroId: 'pomodoro-1',
        associatedTaskId: 'task-1',
        active: true,
        sessionActive: true,
        sessionRunning: true,
        secondsPassedInSession: 60,
        secondsUntilNextTransition: 754,
        currentFocusNumber: 2,
        numFocuses: 4,
        phase: 'FOCUS',
        ...overrides,
    };
}

function renderRunning(overrides: Partial<React.ComponentProps<typeof PomodoroRunningControls>> = {}) {
    const onAdjustTime = vi.fn<(deltaSeconds: number) => void>();
    const props = {
        status: status(),
        waitingForPhase: false,
        isBreak: false,
        timeAdjustmentMinutes: 5,
        canAdjustTime: true,
        onAdjustTime,
        playPauseLabel: 'Pause focus session',
        onPlayPause: vi.fn(),
        onFinishBreak: vi.fn(),
        canStartBreakEarly: false,
        endOptionsOpen: false,
        onToggleEndOptions: vi.fn(),
        ...overrides,
    };
    render(<PomodoroProvider><PomodoroRunningControls {...props} /></PomodoroProvider>);
    return { ...props, onAdjustTime };
}

describe('PomodoroRunningControls', () => {
    it('shows the phase and the time left in the current phase', () => {
        renderRunning();

        expect(screen.getByText('WORK TIME')).toBeInTheDocument();
        expect(screen.getByText('12:34')).toBeInTheDocument();
    });

    it('adds or removes the configured minutes from the current phase', async () => {
        const user = userEvent.setup();
        const props = renderRunning();

        await user.click(screen.getByRole('button', { name: 'Add 5 minutes to the current Pomodoro phase' }));
        await user.click(screen.getByRole('button', { name: 'Remove 5 minutes from the current Pomodoro phase' }));

        expect(props.onAdjustTime.mock.calls).toEqual([[300], [-300]]);
    });

    it('cannot adjust time while the phase cannot change', () => {
        renderRunning({ canAdjustTime: false });

        expect(screen.getByRole('button', { name: 'Add 5 minutes to the current Pomodoro phase' })).toBeDisabled();
    });

    it('offers to end a break early, and no pause button, during a break', async () => {
        const user = userEvent.setup();
        const props = renderRunning({ status: status({ phase: 'BREAK' }), isBreak: true });

        expect(screen.getByText('BREAK TIME')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Pause focus session' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'End break and start the next focus session' }));

        expect(props.onFinishBreak).toHaveBeenCalledOnce();
    });

    it('waits for the user between phases instead of counting down', () => {
        renderRunning({
            status: status({ phase: 'WAITING_FOR_BREAK' }),
            waitingForPhase: true,
            isBreak: true,
            playPauseLabel: 'Start break',
        });

        expect(screen.getByText('BREAK')).toBeInTheDocument();
        expect(screen.queryByText('12:34')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start break' })).toBeInTheDocument();
    });
});

describe('PomodoroSetupForm', () => {
    const form = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, longBreakCooldown: 4, numFocuses: 4 };
    const fieldMax = { focusDuration: 180, shortBreakDuration: 60, longBreakDuration: 60, numFocuses: 12 };

    it('starts only when the form is valid', async () => {
        const user = userEvent.setup();
        const onStart = vi.fn();
        const { rerender } = render(
            <PomodoroSetupForm form={form} durationUnit="minutes" fieldMax={fieldMax} canStart={false} onChange={vi.fn()} onStart={onStart} />,
        );
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();

        rerender(<PomodoroSetupForm form={form} durationUnit="minutes" fieldMax={fieldMax} canStart onChange={vi.fn()} onStart={onStart} />);
        await user.click(screen.getByRole('button', { name: 'Start' }));

        expect(onStart).toHaveBeenCalledOnce();
    });
});

describe('PomodoroCompleteSummary', () => {
    it('sums up the finished Pomodoro and can be dismissed', async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        render(<PomodoroCompleteSummary totalFocusSeconds={1500} completedFocusSessions={4} numFocuses={4} onDismiss={onDismiss} />);

        expect(screen.getByText('25m 00s focused · 4 of 4 sessions completed')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Dismiss' }));

        expect(onDismiss).toHaveBeenCalledOnce();
    });
});
