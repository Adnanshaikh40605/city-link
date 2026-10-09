/** Accept a raw 11-char id or a YouTube watch/share/embed URL. */
export function extractYoutubeId(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
      return /^[\w-]{11}$/.test(id) ? id : trimmed;
    }
    if (host.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      for (const key of ['embed', 'live', 'shorts']) {
        const i = parts.indexOf(key);
        const id = i >= 0 ? parts[i + 1] : '';
        if (id && /^[\w-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}
