import { describe, expect, it, vi } from 'vitest';
import { findImages, takePictureTerms } from './wikimedia.js';

describe('pictures for lessons', () => {
  it('takes the PICTURES line out of the lesson', () => {
    const { markdown, terms } = takePictureTerms(
      '# Guitar\n\nText.\n\n## Key points\n\n- One\n\n**PICTURES:** acoustic guitar | "fretboard" | x',
    );
    expect(markdown).toBe('# Guitar\n\nText.\n\n## Key points\n\n- One');
    expect(terms).toEqual(['acoustic guitar', 'fretboard']);
  });

  it('turns a Commons search into credited images, skipping non-images', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          query: {
            pages: {
              '2': {
                index: 2,
                title: 'File:Second.png',
                imageinfo: [{ url: 'u2', descriptionurl: 'd2', mime: 'image/png' }],
              },
              '1': {
                index: 1,
                title: 'File:Guitar.jpg',
                imageinfo: [
                  {
                    url: 'u1',
                    thumburl: 't1',
                    descriptionurl: 'd1',
                    mime: 'image/jpeg',
                    extmetadata: {
                      Artist: { value: '<a href="x">Jane</a>' },
                      LicenseShortName: { value: 'CC BY-SA 4.0' },
                    },
                  },
                ],
              },
              '3': {
                index: 3,
                title: 'File:Doc.pdf',
                imageinfo: [{ url: 'u3', descriptionurl: 'd3', mime: 'application/pdf' }],
              },
            },
          },
        }),
      ),
    );
    const images = await findImages('guitar', 3, fetchMock as unknown as typeof fetch);
    expect(images).toEqual([
      {
        url: 'u1',
        thumbUrl: 't1',
        title: 'Guitar',
        credit: 'Jane',
        license: 'CC BY-SA 4.0',
        sourceUrl: 'd1',
      },
      {
        url: 'u2',
        thumbUrl: 'u2',
        title: 'Second',
        credit: 'Wikimedia Commons',
        license: 'See source',
        sourceUrl: 'd2',
      },
    ]);
    // No personal data is sent: only the search term and a generic app name.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('gsrsearch=guitar');
    expect(init.headers['user-agent']).toMatch(/^StudyThinker/);
  });

  it('never fails a lesson when Commons is unreachable', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('reset'));
    await expect(findImages('x', 1, failing as unknown as typeof fetch)).resolves.toEqual([]);
  });
});
