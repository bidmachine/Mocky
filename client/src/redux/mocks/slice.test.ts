import { selectAllMocks } from './slice';
import { MockStored } from './types';
import { RootState } from '../store';

const mock = (name: string, createdAt?: string): MockStored =>
  ({ id: name, secret: 's', name, createdAt } as unknown) as MockStored;

const stateWith = (all: MockStored[]) => (({ mocks: { last: undefined, all } } as unknown) as RootState);

describe('selectAllMocks', () => {
  it('puts the newest mock first, whatever order they were stored in', () => {
    const state = stateWith([
      mock('oldest', '2026-09-01T10:00:00.000Z'),
      mock('newest', '2026-09-11T10:00:00.000Z'),
      mock('middle', '2026-09-05T10:00:00.000Z'),
    ]);

    expect(selectAllMocks(state).map((m) => m.name)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('keeps a mock with no date, and sorts it last', () => {
    // An entry stored by an older build has no createdAt. A comparator returning NaN leaves the
    // whole order undefined, which put the newest mock at the bottom.
    const state = stateWith([
      mock('oldest', '2026-09-01T10:00:00.000Z'),
      mock('undated'),
      mock('newest', '2026-09-11T10:00:00.000Z'),
    ]);

    expect(selectAllMocks(state).map((m) => m.name)).toEqual(['newest', 'oldest', 'undated']);
  });

  it('keeps the order of dated mocks correct around several undated ones', () => {
    // A comparator that returns NaN does not merely misplace the undated row: it leaves the
    // order of the rows around it undefined, so the dated ones scramble too.
    const state = stateWith([
      mock('jan', '2026-01-01T00:00:00.000Z'),
      mock('undated-a'),
      mock('mar', '2026-03-01T00:00:00.000Z'),
      mock('feb', '2026-02-01T00:00:00.000Z'),
      mock('undated-b'),
    ]);

    expect(selectAllMocks(state).map((m) => m.name)).toEqual(['mar', 'feb', 'jan', 'undated-a', 'undated-b']);
  });

  it('treats an unparseable date the same as a missing one', () => {
    const state = stateWith([
      mock('broken', 'not-a-date'),
      mock('good', '2026-03-01T00:00:00.000Z'),
    ]);

    expect(selectAllMocks(state).map((m) => m.name)).toEqual(['good', 'broken']);
  });

  it('leaves the stored list untouched', () => {
    const all = [mock('a', '2026-09-01T10:00:00.000Z'), mock('b', '2026-09-11T10:00:00.000Z')];
    selectAllMocks(stateWith(all));

    expect(all.map((m) => m.name)).toEqual(['a', 'b']);
  });
});
