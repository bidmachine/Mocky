/**
 * Build a safe, absolute URL for a mock link.
 *
 * Mock links are returned by the API and persisted in local-storage. If the API was configured
 * with an endpoint missing its scheme, the stored link is *relative* (ex: `mocky.example.com/v3/<id>`).
 * Rendering it in an `<a href>` makes the browser resolve it against the current page, which
 * duplicates the host (`https://mocky.example.com/mocky.example.com/v3/<id>`) and breaks the link.
 *
 * Mocks already saved before the API was fixed keep their broken link, so links are repaired
 * at render time as well.
 */
const HAS_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

export const absoluteMockLink = (link?: string): string => {
  const trimmed = (link ?? '').trim();

  if (trimmed === '' || HAS_SCHEME.test(trimmed)) {
    return trimmed;
  }

  // Protocol-relative link (`//host/path`) already carries its host: only the scheme is missing.
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed.replace(/^\/+/, '')}`;
};

export default absoluteMockLink;
