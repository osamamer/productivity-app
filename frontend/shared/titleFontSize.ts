export type TitleFontScale = {
    max: number;
    min: number;
    /** Length at which the title starts to shrink. */
    shrinkFrom: number;
    /** Length at which it reaches `min`. */
    shrinkTo: number;
};

/** A title's font size, shrinking linearly with its length so long titles stay readable while they wrap. */
export function titleFontSize(title: string, { max, min, shrinkFrom, shrinkTo }: TitleFontScale): number {
    const progress = (title.trim().length - shrinkFrom) / (shrinkTo - shrinkFrom);
    const scale = Math.min(1, Math.max(0, progress));
    return Math.round((max - (max - min) * scale) * 100) / 100;
}
