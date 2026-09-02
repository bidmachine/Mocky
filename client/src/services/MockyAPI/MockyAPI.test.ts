import MockyAPI from './MockyAPI';
import HTTP from '../HTTP';
import { MockStored } from '../../redux/mocks/types';

jest.mock('../HTTP');

const mock: MockStored = {
  id: 'c7b8ba84-19da-4f51-bbca-25ef1e4bb3da',
  secret: 'the-secret',
  link: 'https://run.mocky.io/v3/c7b8ba84-19da-4f51-bbca-25ef1e4bb3da',
  name: 'users-list',
  status: 200,
  contentType: 'application/json',
  charset: 'UTF-8',
  content: '{"a":1}',
  deleteLink: '',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

describe('MockyAPI.update', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns the updated mock when the API accepted the change', async () => {
    (HTTP.put as jest.Mock).mockResolvedValue(true);

    const updated = await MockyAPI.update(mock, { name: 'renamed' });

    expect(updated?.name).toBe('renamed');
    expect(updated?.link).toBe(mock.link);
  });

  it('returns undefined when the API rejected the change', async () => {
    (HTTP.put as jest.Mock).mockResolvedValue(false);

    expect(await MockyAPI.update(mock, { name: 'renamed' })).toBeUndefined();
  });

  it('reports a failure instead of throwing when the API is unreachable', async () => {
    (HTTP.put as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(MockyAPI.update(mock, { name: 'renamed' })).resolves.toBeUndefined();
  });
});
