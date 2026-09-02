import { absoluteMockLink } from './url';

describe('absoluteMockLink', () => {
  it('keeps an already absolute link untouched', () => {
    expect(absoluteMockLink('https://run.mocky.io/v3/abc')).toBe('https://run.mocky.io/v3/abc');
    expect(absoluteMockLink('http://0.0.0.0:8080/v3/abc')).toBe('http://0.0.0.0:8080/v3/abc');
  });

  it('makes a scheme-less link absolute, so the host is not duplicated on open', () => {
    expect(absoluteMockLink('mocky.example.com/v3/abc')).toBe('https://mocky.example.com/v3/abc');
  });

  it('keeps the host of a protocol-relative link', () => {
    expect(absoluteMockLink('//mocky.example.com/v3/abc')).toBe('https://mocky.example.com/v3/abc');
  });

  it('handles an empty or missing link', () => {
    expect(absoluteMockLink('')).toBe('');
    expect(absoluteMockLink(undefined)).toBe('');
  });

  it('trims the surrounding whitespaces', () => {
    expect(absoluteMockLink('  https://run.mocky.io/v3/abc ')).toBe('https://run.mocky.io/v3/abc');
  });
});
