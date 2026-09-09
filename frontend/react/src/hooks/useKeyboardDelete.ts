import { useEffect, useRef } from 'react';

interface KeyboardDeleteOptions {
    enabled: boolean;
    onDelete: () => void;
    allowDialog?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
    return target instanceof Element
        && target.closest(
            'input:not([type="checkbox"]):not([type="radio"]), textarea, select, [role="combobox"], [contenteditable]:not([contenteditable="false"])',
        ) !== null;
}

function isTaskTitleTarget(target: EventTarget | null): boolean {
    return target instanceof Element
        && target.closest('[data-task-name-input="true"]') !== null;
}

/**
 * Binds the plain Delete key without interfering with text editing or dialog controls.
 * Task title inputs intentionally opt into the shortcut because their containing
 * task remains the selected entity while the title is being edited.
 * The callback is kept in a ref so pages can update their selected item without
 * repeatedly attaching a global listener.
 */
export function useKeyboardDelete({ enabled, onDelete, allowDialog = false }: KeyboardDeleteOptions): void {
    const onDeleteRef = useRef(onDelete);
    onDeleteRef.current = onDelete;

    useEffect(() => {
        if (!enabled) return undefined;

        const handleKeyDown = (event: KeyboardEvent) => {
            const taskTitleTarget = isTaskTitleTarget(event.target);
            if ((event.defaultPrevented && !taskTitleTarget)
                || event.isComposing
                || event.key !== 'Delete'
                || event.altKey
                || event.ctrlKey
                || event.metaKey
                || event.shiftKey
                || (isEditableTarget(event.target) && !taskTitleTarget)
                || (event.target instanceof Element
                    && !allowDialog
                    && event.target.closest('[role="dialog"], [role="menu"]'))
            ) {
                return;
            }

            event.preventDefault();
            onDeleteRef.current();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [allowDialog, enabled]);
}

export function findKeyboardDeleteAnchor(attribute: string, value: string): HTMLElement | null {
    return Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`))
        .find(element => element.getAttribute(attribute) === value) ?? null;
}
