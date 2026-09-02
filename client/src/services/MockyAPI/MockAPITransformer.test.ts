import MockyAPITransformer from './MockAPITransformer';
import { MockStored } from '../../redux/mocks/types';

const mock: MockStored = {
  id: 'c7b8ba84-19da-4f51-bbca-25ef1e4bb3da',
  secret: 'the-secret',
  link: 'https://run.mocky.io/v3/c7b8ba84-19da-4f51-bbca-25ef1e4bb3da',
  name: 'users-list',
  status: 200,
  contentType: 'application/json',
  charset: 'UTF-8',
  content: '{"a":1}',
  // The designer stores the parsed object, not a string; see parseHeaders
  headers: { 'X-FOO': 'bar' } as any,
  deleteLink: 'https://mocky.io/manage/delete/id/secret',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('storedToUpdateApi', () => {
  it('sends back every field, because the API replaces the whole mock', () => {
    const payload = MockyAPITransformer.storedToUpdateApi(mock, { content: '{"a":2}' });

    expect(payload).toEqual({
      status: 200,
      content: '{"a":2}',
      content_type: 'application/json',
      charset: 'UTF-8',
      secret: 'the-secret',
      name: 'users-list',
      expiration: 'never',
      headers: { 'X-FOO': 'bar' },
    });
  });

  it('keeps a mock without expiration on "never", so editing does not make it expire', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { content: 'x' }).expiration).toBe('never');
  });

  it('sends the edited name', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { name: 'renamed' }).name).toBe('renamed');
  });

  it('keeps the current name when only the body is edited', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { content: 'x' }).name).toBe('users-list');
  });

  it('keeps the current body when only the name is edited', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { name: 'renamed' }).content).toBe('{"a":1}');
  });

  it('trims the name and drops it when it is blank', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { name: '  spaced  ' }).name).toBe('spaced');
    expect(MockyAPITransformer.storedToUpdateApi(mock, { name: '   ' }).name).toBeUndefined();
  });

  const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const expirationFor = (days: number) =>
    MockyAPITransformer.storedToUpdateApi({ ...mock, expireAt: inDays(days) }, { content: 'x' }).expiration;

  it('never pushes an expiry further away, because the API resets it to now + duration', () => {
    // Rounding up would turn 300 remaining days into a fresh 361, extending the mock silently
    expect(expirationFor(300)).toBe('1month');
    expect(expirationFor(2)).toBe('1day');
    expect(expirationFor(6)).toBe('1day');
  });

  it('keeps a bucket that still fits exactly', () => {
    expect(expirationFor(400)).toBe('1year');
    expect(expirationFor(31)).toBe('1month');
    expect(expirationFor(7)).toBe('1week');
  });

  it('does not resurrect a mock that already expired', () => {
    // The shortest bucket is the least the API can be asked for; it must not be a long one
    expect(expirationFor(-5)).toBe('1day');
  });

  it('sends no content for an emptied body', () => {
    expect(MockyAPITransformer.storedToUpdateApi(mock, { content: '' }).content).toBeUndefined();
  });

  it('sends no headers when the mock has none', () => {
    const withoutHeaders = { ...mock, headers: undefined };
    expect(MockyAPITransformer.storedToUpdateApi(withoutHeaders, { content: 'x' }).headers).toBeUndefined();
  });
});

describe('updatedToStore', () => {
  it('keeps the id and the link untouched, so saved links stay valid', () => {
    const updated = MockyAPITransformer.updatedToStore(mock, { content: '{"a":2}' });

    expect(updated.id).toBe(mock.id);
    expect(updated.link).toBe(mock.link);
    expect(updated.secret).toBe(mock.secret);
    expect(updated.content).toBe('{"a":2}');
  });

  it('stores an emptied body as no content', () => {
    expect(MockyAPITransformer.updatedToStore(mock, { content: '' }).content).toBeUndefined();
  });

  it('stores the renamed mock', () => {
    expect(MockyAPITransformer.updatedToStore(mock, { name: 'renamed' }).name).toBe('renamed');
  });

  it('stores a blank name as no name, so the list falls back on the id', () => {
    expect(MockyAPITransformer.updatedToStore(mock, { name: '  ' }).name).toBeUndefined();
  });
});
