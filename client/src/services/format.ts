/**
 * Pretty-print the body of a mock for the preview, based on its content-type.
 *
 * Mock bodies are stored exactly as typed, so they are often minified. Formatting is best-effort:
 * a body that cannot be parsed (a truncated payload, a non-JSON content-type) is returned
 * untouched rather than replaced by an error, because the preview must always show something.
 */
export const formatBody = (content: string, contentType: string): string => {
  const body = content ?? '';

  if (isJson(contentType)) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch (e) {
      return body;
    }
  }

  return body;
};

export const isJson = (contentType: string): boolean => /json/i.test(contentType ?? '');

/**
 * Language used to highlight the body. `text` disables the highlighting.
 */
export const highlightLanguage = (contentType: string): 'json' | 'xml' | 'html' | 'text' => {
  const type = contentType ?? '';
  if (isJson(type)) return 'json';
  if (/html/i.test(type)) return 'html';
  if (/xml/i.test(type)) return 'xml';
  return 'text';
};

/**
 * Whether the edited body is still valid for its content-type, so the user is warned
 * before saving a JSON mock that no longer parses.
 */
export const isValidForContentType = (content: string, contentType: string): boolean => {
  if (!isJson(contentType)) return true;
  if ((content ?? '').trim() === '') return true;

  try {
    JSON.parse(content);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Short, human readable size of a body (the mock content is stored as an UTF-8 string).
 */
export const humanSize = (content?: string): string => {
  const bytes = new Blob([content ?? '']).size;

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Format a JSON payload that was just pasted into an editor.
 *
 * Pasted responses are usually minified, which makes them unreadable. Only a payload that
 * actually parses is reformatted: anything else (a partial paste, a non-JSON body) is returned
 * unchanged, so pasting never destroys what the user meant to paste.
 */
export const beautifyOnPaste = (pasted: string, contentType: string): string => {
  const text = pasted ?? '';

  if (!isJson(contentType) || text.trim() === '') return text;

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch (e) {
    return text;
  }
};

/**
 * Read the headers of a stored mock as pairs.
 *
 * `MockStored.headers` is typed as a string, but a mock created through the designer stores the
 * parsed object the API was sent, while one restored from an older entry holds the raw JSON
 * string. Both shapes have to be accepted: assuming either one crashes the management console
 * on the mocks stored in the other shape.
 */
export const parseHeaders = (headers?: string | Record<string, unknown>): [string, string][] => {
  if (headers === undefined || headers === null || headers === '') return [];

  const parsed = typeof headers === 'string' ? tryParseJson(headers) : headers;

  if (typeof parsed !== 'object' || parsed === null) return [];

  return Object.entries(parsed).map(([key, value]) => [key, String(value)]);
};

/**
 * Headers of a stored mock, in the object form the API expects, or `undefined` when it has none.
 */
export const headersForApi = (headers?: string | Record<string, unknown>): Record<string, unknown> | undefined => {
  const entries = parseHeaders(headers);

  if (entries.length === 0) return undefined;

  // Built without `Object.fromEntries`, which the ES5 target of this app does not provide.
  return entries.reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const tryParseJson = (value: string): unknown => {
  if (value.trim() === '') return undefined;

  try {
    return JSON.parse(value);
  } catch (e) {
    return undefined;
  }
};
