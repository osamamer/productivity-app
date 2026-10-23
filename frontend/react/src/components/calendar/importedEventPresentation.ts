const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

const INVITATION_DETAILS = /(?:microsoft\s+teams\s+meeting|meeting\s+id\s*:|passcode\s*:|join\s+(?:a\s+)?video conferencing device|for organizers\s*:|meeting options|system reference|tenant key\s*:|join\s*:)/i;

export type ImportedEventPresentation = {
    description: string | null;
    meetingUrl: string | null;
};

export function importedEventPresentation(title: string, description: string): ImportedEventPresentation {
    const normalized = normalizeDescription(description);
    if (!normalized) return { description: null, meetingUrl: null };

    const invitationDetails = INVITATION_DETAILS.test(normalized);
    const urls = [...normalized.matchAll(URL_PATTERN)].map(match => trimUrl(match[0]));
    const meetingUrl = urls.find(isConferenceUrl) ?? (invitationDetails ? urls[0] : undefined) ?? null;

    if (meetingUrl || invitationDetails) {
        return { description: null, meetingUrl };
    }

    const readable = normalized
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/^-{3,}$/.test(line))
        .join('\n');
    if (!readable || readable.localeCompare(title.trim(), undefined, { sensitivity: 'accent' }) === 0) {
        return { description: null, meetingUrl: null };
    }

    const maxLength = 500;
    return {
        description: readable.length > maxLength ? `${readable.slice(0, maxLength).trimEnd()}…` : readable,
        meetingUrl: null,
    };
}

function normalizeDescription(description: string): string {
    return description
        .replace(/\\[nN]/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\')
        .replace(/<(https?:\/\/[^>\s]+)>/gi, '$1')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<\/(?:p|div)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .trim();
}

function trimUrl(value: string): string {
    return value.replace(/[),.;]+$/g, '');
}

function isConferenceUrl(value: string): boolean {
    try {
        const hostname = new URL(value).hostname.toLowerCase();
        return hostname === 'meet.google.com'
            || hostname === 'teams.microsoft.com'
            || hostname.endsWith('.teams.microsoft.com')
            || hostname === 'zoom.us'
            || hostname.endsWith('.zoom.us')
            || hostname === 'webex.com'
            || hostname.endsWith('.webex.com')
            || hostname.endsWith('.bluejeans.com')
            || hostname.endsWith('.gotomeeting.com')
            || hostname === 'meet.jit.si'
            || hostname.endsWith('.whereby.com');
    } catch {
        return false;
    }
}
