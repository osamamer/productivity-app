export type AccentColor = 'violet' | 'teal' | 'coral' | 'sage';

type ColorPalette = { main: string; light: string; dark: string; contrastText: string };

export const accentPalettes: Record<AccentColor, {
    label: string;
    light: ColorPalette;
    dark: ColorPalette;
    secondary: {
        light: ColorPalette;
        dark: ColorPalette;
    };
}> = {
    violet: {
        label: 'Violet',
        light: { main: '#946AF5', light: '#B7A0FA', dark: '#6F44D8', contrastText: '#FFFFFF' },
        dark: { main: '#A395F2', light: '#C6BCF7', dark: '#7A69D9', contrastText: '#111827' },
        secondary: {
            light: { main: '#C9A227', light: '#E0C45D', dark: '#967617', contrastText: '#1A1A2E' },
            dark: { main: '#F0D264', light: '#F6E5A0', dark: '#C7A52B', contrastText: '#1A1A2E' },
        },
    },
    teal: {
        label: 'Teal',
        light: { main: '#0F9D8A', light: '#5BCBBE', dark: '#0A6F61', contrastText: '#FFFFFF' },
        dark: { main: '#52CDBD', light: '#8DE2D6', dark: '#289A8C', contrastText: '#0F172A' },
        secondary: {
            light: { main: '#E56B6F', light: '#F09CA0', dark: '#C44F53', contrastText: '#FFFFFF' },
            dark: { main: '#F08E84', light: '#F6B4AE', dark: '#D96A5F', contrastText: '#111827' },
        },
    },
    coral: {
        label: 'Coral',
        light: { main: '#E56B6F', light: '#F09CA0', dark: '#C44F53', contrastText: '#FFFFFF' },
        dark: { main: '#F08E84', light: '#F6B4AE', dark: '#D96A5F', contrastText: '#111827' },
        secondary: {
            light: { main: '#0F9D8A', light: '#5BCBBE', dark: '#0A6F61', contrastText: '#FFFFFF' },
            dark: { main: '#52CDBD', light: '#8DE2D6', dark: '#289A8C', contrastText: '#0F172A' },
        },
    },
    sage: {
        label: 'Sage',
        light: { main: '#789B78', light: '#A5C5A0', dark: '#557A5D', contrastText: '#FFFFFF' },
        dark: { main: '#A8CBA2', light: '#C7DEBF', dark: '#7FA47A', contrastText: '#172219' },
        secondary: {
            light: { main: '#8A8ED8', light: '#B0B3E8', dark: '#666BB7', contrastText: '#FFFFFF' },
            dark: { main: '#B7B9F0', light: '#D2D4FA', dark: '#898CD3', contrastText: '#17182C' },
        },
    },
};

export const accentColorOptions = Object.entries(accentPalettes).map(([value, config]) => ({
    value: value as AccentColor,
    label: config.label,
    swatch: config.light.main,
}));
