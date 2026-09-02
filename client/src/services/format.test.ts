import { formatBody, highlightLanguage, humanSize, isValidForContentType } from './format';

describe('formatBody', () => {
  it('pretty-prints a minified JSON body', () => {
    expect(formatBody('{"a":1}', 'application/json')).toBe('{\n  "a": 1\n}');
  });

  it('returns an unparsable JSON body untouched, so the preview still shows something', () => {
    expect(formatBody('{"a":', 'application/json')).toBe('{"a":');
  });

  it('leaves a non-JSON body untouched', () => {
    expect(formatBody('<a>1</a>', 'application/xml')).toBe('<a>1</a>');
    expect(formatBody('hello', 'text/plain')).toBe('hello');
  });

  it('handles an empty body', () => {
    expect(formatBody('', 'application/json')).toBe('');
  });
});

describe('highlightLanguage', () => {
  it('detects the language from the content-type', () => {
    expect(highlightLanguage('application/json')).toBe('json');
    expect(highlightLanguage('text/html')).toBe('html');
    expect(highlightLanguage('application/xml')).toBe('xml');
    expect(highlightLanguage('text/plain')).toBe('text');
  });
});

describe('isValidForContentType', () => {
  it('accepts a valid JSON body', () => {
    expect(isValidForContentType('{"a":1}', 'application/json')).toBe(true);
  });

  it('rejects a JSON body that no longer parses', () => {
    expect(isValidForContentType('{"a":', 'application/json')).toBe(false);
  });

  it('accepts an empty body, which is a valid mock', () => {
    expect(isValidForContentType('', 'application/json')).toBe(true);
    expect(isValidForContentType('   ', 'application/json')).toBe(true);
  });

  it('does not validate a body that is not JSON', () => {
    expect(isValidForContentType('not json at all', 'text/plain')).toBe(true);
  });
});

describe('humanSize', () => {
  it('formats the size of a body', () => {
    expect(humanSize('abc')).toBe('3 B');
    expect(humanSize('a'.repeat(2048))).toBe('2.0 KB');
  });

  it('handles a missing body', () => {
    expect(humanSize(undefined)).toBe('0 B');
  });
});
