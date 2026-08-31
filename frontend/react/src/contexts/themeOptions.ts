export type AccentColor = 'violet' | 'teal' | 'coral' | 'amber';

export const accentPalettes: Record<AccentColor, {
    label: string;
    light: { main: string; light: string; dark: string; contrastText: string };
    dark: { main: string; light: string; dark: string; contrastText: string };
}> = {
    violet: {
        label: 'Violet',
        light: { main: '#946AF5', light: '#B7A0FA', dark: '#6F44D8', contrastText: '#FFFFFF' },
        dark: { main: '#A395F2', light: '#C6BCF7', dark: '#7A69D9', contrastText: '#111827' },
    },
    teal: {
        label: 'Teal',
        light: { main: '#0F9D8A', light: '#5BCBBE', dark: '#0A6F61', contrastText: '#FFFFFF' },
        dark: { main: '#52CDBD', light: '#8DE2D6', dark: '#289A8C', contrastText: '#0F172A' },
    },
    coral: {
        label: 'Coral',
        light: { main: '#E56B6F', light: '#F09CA0', dark: '#C44F53', contrastText: '#FFFFFF' },
        dark: { main: '#F08E84', light: '#F6B4AE', dark: '#D96A5F', contrastText: '#111827' },
    },
    amber: {
        label: 'Amber',
        light: { main: '#D18B00', light: '#E6B54D', dark: '#9E6700', contrastText: '#FFFFFF' },
        dark: { main: '#F1B93A', light: '#F6D27D', dark: '#D99912', contrastText: '#111827' },
    },
};

export const accentColorOptions = Object.entries(accentPalettes).map(([value, config]) => ({
    value: value as AccentColor,
    label: config.label,
    swatch: config.light.main,
}));
