import type { ReactNode } from 'react';
import Popover, { type PopoverProps } from '@mui/material/Popover';
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
    const paperSlotProps = slotProps?.paper as unknown as { sx?: SxProps<Theme> } | undefined;
    const paperSx = paperSlotProps?.sx;

    return (
        <Popover
            {...props}
            open={props.open}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? {
                top: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
                left: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
            }}
            transformOrigin={anchorPosition
                ? { vertical: 'top', horizontal: 'left' }
                : { vertical: 'center', horizontal: 'center' }}
            disableScrollLock
            slotProps={{
                ...slotProps,
                paper: {
                    role: 'dialog',
                    'aria-modal': false,
                    ...paperSlotProps,
                    sx: [
                        {
                            boxSizing: 'border-box',
                            width: fullWidth ? `${width}px` : 'auto',
                            maxWidth: `min(calc(100vw - 32px), ${width}px)`,
                            maxHeight: 'min(84vh, 760px)',
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
