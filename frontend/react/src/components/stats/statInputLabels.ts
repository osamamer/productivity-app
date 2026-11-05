import { StatType } from '../../types/Stats';

export function statInputLabel(type: StatType): string {
    switch (type) {
        case 'BOOLEAN': return 'Yes / no';
        case 'NUMBER': return 'Amount';
        case 'RANGE': return 'Rating (0–10)';
        case 'TIME': return 'Time';
        case 'DURATION': return 'Duration';
    }
}
