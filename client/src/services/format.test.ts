import {
  beautifyOnPaste,
  formatBody,
  headersForApi,
  highlightLanguage,
  humanSize,
  isValidForContentType,
  parseHeaders,
} from './format';

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

describe('beautifyOnPaste', () => {
  it('formats a minified JSON payload that was just pasted', () => {
    expect(beautifyOnPaste('{"a":1,"b":[2]}', 'application/json')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}'
    );
  });

  it('keeps a partial paste untouched, so nothing the user pasted is lost', () => {
    expect(beautifyOnPaste('{"a":', 'application/json')).toBe('{"a":');
  });

  it('does not touch a paste that is not JSON', () => {
    expect(beautifyOnPaste('<a>1</a>', 'application/xml')).toBe('<a>1</a>');
    expect(beautifyOnPaste('{"a":1}', 'text/plain')).toBe('{"a":1}');
  });

  it('handles an empty paste', () => {
    expect(beautifyOnPaste('', 'application/json')).toBe('');
    expect(beautifyOnPaste('   ', 'application/json')).toBe('   ');
  });

  it('formats a JSON array as well', () => {
    expect(beautifyOnPaste('[1,2]', 'application/json')).toBe('[\n  1,\n  2\n]');
  });
});

describe('parseHeaders', () => {
  it('reads headers stored as a JSON string', () => {
    expect(parseHeaders('{"X-FOO":"bar"}')).toEqual([['X-FOO', 'bar']]);
  });

  it('reads headers stored as an object, which is what the designer saves', () => {
    // A mock created through the form stores the parsed object, despite the declared string type
    expect(parseHeaders({ 'X-FOO': 'bar' } as any)).toEqual([['X-FOO', 'bar']]);
  });

  it('returns nothing for a mock without headers', () => {
    expect(parseHeaders(undefined)).toEqual([]);
    expect(parseHeaders('')).toEqual([]);
    expect(parseHeaders('   ')).toEqual([]);
  });

  it('ignores a value that is not a JSON object', () => {
    expect(parseHeaders('not json')).toEqual([]);
    expect(parseHeaders('"a string"')).toEqual([]);
    expect(parseHeaders('null')).toEqual([]);
  });
});

describe('headersForApi', () => {
  it('sends back headers stored as an object without re-parsing them', () => {
    expect(headersForApi({ 'X-FOO': 'bar' } as any)).toEqual({ 'X-FOO': 'bar' });
  });

  it('sends back headers stored as a string', () => {
    expect(headersForApi('{"X-FOO":"bar"}')).toEqual({ 'X-FOO': 'bar' });
  });

  it('sends no headers when the mock has none', () => {
    expect(headersForApi(undefined)).toBeUndefined();
    expect(headersForApi('')).toBeUndefined();
    expect(headersForApi('{}')).toBeUndefined();
  });
});
