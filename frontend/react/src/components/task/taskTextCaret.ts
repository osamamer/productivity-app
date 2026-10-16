type PointCaretDocument = Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export function getTextOffsetAtPoint(element: HTMLElement, x: number, y: number): number | null {
    const doc = element.ownerDocument as PointCaretDocument;
    const point = doc.caretPositionFromPoint?.(x, y);
    const range = point
        ? null
        : doc.caretRangeFromPoint?.(x, y) ?? null;
    const node = point?.offsetNode ?? range?.startContainer;
    const offset = point?.offset ?? range?.startOffset;

    if (!node || offset === undefined || !element.contains(node)) return null;

    const textRange = doc.createRange();
    textRange.selectNodeContents(element);
    textRange.setEnd(node, offset);
    return textRange.toString().length;
}
