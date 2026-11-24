import type { LessonImage } from '@studythinker/shared';

const API = 'https://commons.wikimedia.org/w/api.php';
/** Wikimedia asks API clients to identify themselves; this is a generic app name. */
const USER_AGENT = 'StudyThinker/0.1 (educational learning app)';

function strip(html: string | undefined) {
  return (html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * Finds freely licensed photos on Wikimedia Commons. Best-effort: returns []
 * on any failure, so a lesson never fails because of pictures.
 */
export async function findImages(
  query: string,
  limit = 2,
  fetchImpl: typeof fetch = fetch,
): Promise<LessonImage[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(Math.min(10, limit * 3)),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '960',
  });
  try {
    const res = await fetchImpl(`${API}?${params}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            index?: number;
            title: string;
            imageinfo?: {
              url: string;
              thumburl?: string;
              descriptionurl: string;
              mime?: string;
              extmetadata?: Record<string, { value?: string }>;
            }[];
          }
        >;
      };
    };
    return Object.values(data.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((p) => ({ p, info: p.imageinfo?.[0] }))
      .filter(({ info }) => info && /^image\/(jpeg|png|webp|gif)$/.test(info.mime ?? ''))
      .slice(0, limit)
      .map(({ p, info }) => {
        const meta = info!.extmetadata ?? {};
        return {
          url: info!.url,
          thumbUrl: info!.thumburl ?? info!.url,
          title:
            strip(meta.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.\w+$/, ''),
          credit: strip(meta.Artist?.value) || 'Wikimedia Commons',
          license: strip(meta.LicenseShortName?.value) || 'See source',
          sourceUrl: info!.descriptionurl,
        };
      });
  } catch {
    return [];
  }
}

/** Removes the "PICTURES: a | b" line the AI adds to a lesson and returns its search terms. */
export function takePictureTerms(markdown: string): { markdown: string; terms: string[] } {
  const terms: string[] = [];
  const cleaned = markdown.replace(/^\s*\**PICTURES:?\**\s*(.+)$/gim, (_, list: string) => {
    terms.push(
      ...list
        .split('|')
        .map((t) => t.replace(/["*_`]/g, '').trim())
        .filter((t) => t.length > 1 && t.length < 80),
    );
    return '';
  });
  return { markdown: cleaned.trim(), terms: [...new Set(terms)].slice(0, 3) };
}
