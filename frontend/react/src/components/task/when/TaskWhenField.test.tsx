import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { describe, expect, it, vi } from 'vitest';
import { TaskWhenField } from './TaskWhenField';
import type { WhenChange, WhenDraft } from './whenModel';

const repeatingTask: WhenDraft = {
    date: '2030-03-07',
    time: '09:00',
    reminderMinutesBefore: 15,
    repeat: { kind: 'WEEKLY', every: 2, days: ['MONDAY', 'THURSDAY'], until: null },
    repeatSubtasks: false,
};

function renderField(value: WhenDraft, repeating: boolean, onSave = vi.fn<(change: WhenChange) => void>()) {
    render(
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TaskWhenField value={value} repeating={repeating} canRepeat showRepeatSubtasks={false} onSave={onSave} />
        </LocalizationProvider>,
    );
    return onSave;
}

describe('TaskWhenField', () => {
    it('shows the date, how it repeats and the reminder in one row', () => {
        renderField(repeatingTask, true);

        const field = screen.getByRole('button', { name: /^When:/ });
        expect(field).toHaveTextContent('Thu 7 Mar 2030, 09:00');
        expect(field).toHaveTextContent('Every 2 weeks on Mon, Thu');
        expect(field).toHaveTextContent('15 min');
    });

    it('asks whether a new reminder is for this occurrence or all of them', async () => {
        const user = userEvent.setup();
        const onSave = renderField(repeatingTask, true);

        await user.click(screen.getByRole('button', { name: /^When:/ }));
        expect(screen.queryByText('Apply the new reminder to')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '1 hour' }));
        await user.click(screen.getByRole('button', { name: 'All occurrences' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            reminderChanged: true,
            reminderScope: 'all',
            scheduleChanged: false,
            repeatChanged: false,
            next: expect.objectContaining({ reminderMinutesBefore: 60 }),
        }));
    });

    it('does not ask for a task that does not repeat yet, and saves nothing when nothing changed', async () => {
        const user = userEvent.setup();
        const onSave = renderField({ ...repeatingTask, repeat: { kind: 'NONE', every: 1, days: [], until: null } }, false);

        await user.click(screen.getByRole('button', { name: /^When:/ }));
        await user.click(screen.getByRole('button', { name: '1 day' }));
        expect(screen.queryByText('Apply the new reminder to')).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '15 min' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(onSave).not.toHaveBeenCalled();
    });

    it('chooses weekdays and how often on the Repeat tab', async () => {
        const user = userEvent.setup();
        const onSave = renderField({ ...repeatingTask, repeat: { kind: 'NONE', every: 1, days: [], until: null } }, false);

        await user.click(screen.getByRole('button', { name: /^When:/ }));
        await user.click(screen.getByRole('tab', { name: 'Repeat' }));
        await user.click(screen.getByRole('button', { name: 'Weekly' }));
        await user.click(screen.getByRole('button', { name: 'Sunday' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            repeatChanged: true,
            next: expect.objectContaining({
                repeat: { kind: 'WEEKLY', every: 1, days: ['SUNDAY', 'THURSDAY'], until: null },
            }),
        }));
    });
});
