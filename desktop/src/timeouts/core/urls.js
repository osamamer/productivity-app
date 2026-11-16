/**
 * Normalizes a domain or URL the user typed into the key a URL timer is stored under:
 * `youtube.com` → `https://youtube.com/`, `youtube.com/user/` → `https://youtube.com/user`.
 */
function normalizeUrl(value) {
    let text = String(value ?? '').trim();
    if (!text.includes('://')) text = `https://${text}`;
    let parsed;
    try {
        parsed = new URL(text);
    } catch {
        throw new Error('Enter a domain or an http:// or https:// URL.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname
        || parsed.username || parsed.password || parsed.hash || text.includes('#')) {
        throw new Error('Enter a domain or an http:// or https:// URL without credentials or a fragment.');
    }
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}${parsed.search}`;
}

/**
 * The most specific timer covering `address`: a domain covers its subdomains and every path;
 * a path covers itself and its subpages, but not similarly named paths.
 */
function matchingUrlRule(address, ruleUrls) {
    let page;
    try {
        page = new URL(address);
    } catch {
        return null;
    }
    if (page.protocol !== 'http:' && page.protocol !== 'https:') return null;
    const pageHost = page.hostname.toLowerCase();
    const matches = ruleUrls.filter(ruleUrl => {
        const scope = new URL(ruleUrl);
        const host = scope.hostname.toLowerCase();
        const scopePath = scope.pathname.replace(/\/+$/, '') || '/';
        return (pageHost === host || pageHost.endsWith(`.${host}`))
            && (scopePath === '/' || page.pathname === scopePath || page.pathname.startsWith(`${scopePath}/`));
    });
    matches.sort((a, b) => {
        const first = new URL(a);
        const second = new URL(b);
        return second.pathname.length - first.pathname.length || second.hostname.length - first.hostname.length;
    });
    return matches[0] ?? null;
}

module.exports = { normalizeUrl, matchingUrlRule };
