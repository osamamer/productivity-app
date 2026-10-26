import { useCallback, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode, type Ref } from 'react';
import Popover, { type PopoverActions, type PopoverProps } from '@mui/material/Popover';
import type { SxProps, Theme } from '@mui/material/styles';

type CompactPopoverProps = Omit<PopoverProps, 'anchorReference' | 'anchorPosition' | 'anchorOrigin' | 'transformOrigin'> & {
    anchorPosition?: { top: number; left: number };
    fullWidth?: boolean;
    maxWidth?: false | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    compactConfirmation?: boolean;
    children: ReactNode;
};

const WIDTHS = {
    xs: 360,
    sm: 520,
    md: 680,
    lg: 880,
    xl: 1040,
} as const;

/** A compact, non-dimming popup surface for forms and confirmations. */
export function CompactPopover({
    anchorPosition,
    fullWidth = true,
    maxWidth = 'sm',
    compactConfirmation = false,
    slotProps,
    children,
    ...props
}: CompactPopoverProps) {
    const width = maxWidth ? WIDTHS[maxWidth] : 520;
    const paperSlotProps = slotProps?.paper as unknown as {
        sx?: SxProps<Theme>;
        ref?: Ref<HTMLDivElement>;
    } | undefined;
    const paperSx = paperSlotProps?.sx;
    // MUI mounts its portal after our first layout effect; observe the actual paper mount.
    const [paper, setPaper] = useState<HTMLDivElement | null>(null);
    const popoverActionRef = useRef<PopoverActions>(null);
    const setPaperRef = useCallback((element: HTMLDivElement | null) => {
        setPaper(element);
        const suppliedRef = paperSlotProps?.ref;
        if (typeof suppliedRef === 'function') {
            suppliedRef(element);
        } else if (suppliedRef) {
            (suppliedRef as MutableRefObject<HTMLDivElement | null>).current = element;
        }
    }, [paperSlotProps?.ref]);

    useLayoutEffect(() => {
        if (!props.open) return;
        if (!paper) return;

        // Async form fields can change the paper height after the initial anchor calculation.
        let frame: number | null = null;
        const clampToViewport = () => {
            const margin = 12;
            const maxHeight = `${Math.min(760, Math.max(0, window.innerHeight - margin * 2))}px`;
            const maxWidth = `${Math.max(0, window.innerWidth - margin * 2)}px`;
            if (paper.style.maxHeight !== maxHeight) paper.style.maxHeight = maxHeight;
            if (paper.style.maxWidth !== maxWidth) paper.style.maxWidth = maxWidth;
            if (paper.style.overflow !== 'auto') paper.style.overflow = 'auto';

            const rect = paper.getBoundingClientRect();
            const styleTop = Number.parseFloat(paper.style.top);
            const styleLeft = Number.parseFloat(paper.style.left);
            const currentTop = Number.isFinite(styleTop) ? styleTop : rect.top;
            const currentLeft = Number.isFinite(styleLeft) ? styleLeft : rect.left;
            const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
            const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
            const top = `${Math.max(margin, Math.min(currentTop, maxTop))}px`;
            const left = `${Math.max(margin, Math.min(currentLeft, maxLeft))}px`;
            if (paper.style.top !== top) paper.style.top = top;
            if (paper.style.left !== left) paper.style.left = left;
        };
        const scheduleClamp = () => {
            if (frame !== null) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = null;
                clampToViewport();
            });
        };
        const repositionAndClamp = () => {
            popoverActionRef.current?.updatePosition();
            clampToViewport();
        };

        const mutationObserver = typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver(scheduleClamp);
        mutationObserver?.observe(paper, { attributes: true, attributeFilter: ['style'] });
        const observer = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(() => {
                repositionAndClamp();
            });
        observer?.observe(paper);
        document.addEventListener('scroll', repositionAndClamp, true);
        window.addEventListener('resize', repositionAndClamp);
        repositionAndClamp();

        return () => {
            observer?.disconnect();
            mutationObserver?.disconnect();
            document.removeEventListener('scroll', repositionAndClamp, true);
            window.removeEventListener('resize', repositionAndClamp);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [anchorPosition?.left, anchorPosition?.top, paper, props.open]);

    return (
        <Popover
            {...props}
            action={popoverActionRef}
            open={props.open}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? {
                top: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
                left: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
            }}
            transformOrigin={anchorPosition
                ? { vertical: 'top', horizontal: 'left' }
                : { vertical: 'center', horizontal: 'center' }}
            marginThreshold={12}
            disableScrollLock
            slotProps={{
                ...slotProps,
                paper: {
                    role: 'dialog',
                    'aria-modal': false,
                    ...paperSlotProps,
                    ref: setPaperRef,
                    sx: [
                        {
                            boxSizing: 'border-box',
                            width: fullWidth ? `${width}px` : 'auto',
                            maxWidth: `min(calc(100vw - 32px), ${width}px)`,
                            maxHeight: 'min(calc(100vh - 24px), 760px)',
                            overflow: 'auto',
                            ...(compactConfirmation ? {
                                '& .MuiDialogTitle-root': {
                                    px: 1.5,
                                    pt: 1.25,
                                    pb: 0.5,
                                    fontSize: '0.9rem',
                                    lineHeight: 1.3,
                                },
                                '& .MuiDialogContent-root': {
                                    px: 1.5,
                                    py: 0.5,
                                    fontSize: '0.8rem',
                                },
                                '& .MuiDialogContent-root .MuiDialogContentText-root, & .MuiDialogContent-root .MuiTypography-body2': {
                                    fontSize: '0.8rem',
                                    lineHeight: 1.4,
                                },
                                '& .MuiDialogActions-root': {
                                    px: 1.25,
                                    pt: 0.5,
                                    pb: 1,
                                    gap: 0.5,
                                },
                                '& .MuiDialogActions-root .MuiButton-root': {
                                    minWidth: 0,
                                    px: 0.75,
                                    py: 0.35,
                                    fontSize: '0.72rem',
                                },
                            } : {}),
                        },
                        ...(Array.isArray(paperSx) ? paperSx : paperSx ? [paperSx] : []),
                    ],
                },
            }}
        >
            {children}
        </Popover>
    );
}
