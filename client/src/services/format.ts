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
