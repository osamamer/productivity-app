export interface DayEntity {
    id: number;
    rating: number;
    plan: string;
    summary: string;
    localDate: string;
    appliedTemplateId?: string | null;
    appliedTemplateName?: string | null;
}

export interface DayCalendarEntry {
    date: string;
    appliedTemplateId: string | null;
    appliedTemplateName: string | null;
}
