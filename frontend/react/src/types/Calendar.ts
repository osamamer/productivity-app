export type CalendarColor = 'accent' | 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'teal' | 'pink' | 'indigo';

export type Calendar = {
    id: string;
    name: string;
    color: CalendarColor;
    displayOrder: number;
    defaultCalendar: boolean;
    visible: boolean;
};

export type CalendarUpdate = Partial<Pick<Calendar, 'name' | 'color' | 'displayOrder' | 'visible'>>;

export const CALENDAR_COLORS: Array<{ value: CalendarColor; label: string; hex: string }> = [
    { value: 'accent', label: 'Accent', hex: '#9584d6' },
    { value: 'blue', label: 'Blue', hex: '#a9c9e8' },
    { value: 'purple', label: 'Purple', hex: '#7154a5' },
    { value: 'green', label: 'Green', hex: '#a9d2ba' },
    { value: 'orange', label: 'Orange', hex: '#efc29e' },
    { value: 'red', label: 'Red', hex: '#a14f54' },
    { value: 'teal', label: 'Teal', hex: '#9dcfca' },
    { value: 'pink', label: 'Pink', hex: '#e3b0c7' },
    { value: 'indigo', label: 'Indigo', hex: '#4e649f' },
];

export function calendarColorHex(color: string | null | undefined, accentColor = CALENDAR_COLORS[0].hex): string {
    if (color === 'accent') return accentColor;
    return CALENDAR_COLORS.find(option => option.value === color)?.hex ?? accentColor;
}
