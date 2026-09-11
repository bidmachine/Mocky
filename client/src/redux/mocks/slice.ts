import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { MockState, MockStored } from './types';

const initialState: MockState = {
  last: undefined,
  all: [],
};

export const mocksSlice = createSlice({
  name: 'mocks',
  initialState,
  reducers: {
    store: (state, action: PayloadAction<MockStored>) => {
      state.last = action.payload;
      state.all.push(action.payload);
    },
    update: (state, action: PayloadAction<MockStored>) => {
      const index = state.all.findIndex((mock) => mock.id === action.payload.id);
      if (index !== -1) state.all[index] = action.payload;
      if (state.last?.id === action.payload.id) state.last = action.payload;
    },
    setCaptureLimit: (state, action: PayloadAction<{ id: string; limit: number }>) => {
      const mock = state.all.find((m) => m.id === action.payload.id);
      if (mock) mock.captureLimit = action.payload.limit;
    },
    remove: (state, action: PayloadAction<string>) => {
      state.all = state.all.filter((mock) => mock.id !== action.payload);
    },
    clearNew: (state) => {
      state.last = undefined;
    },
  },
});

export const { store, update, setCaptureLimit, remove, clearNew } = mocksSlice.actions;

export const selectLatestMock = (state: RootState) => state.mocks.last;
/**
 * Newest first.
 *
 * Mocks are appended as they are created, so the list read in creation order buried the one just
 * made under everything older — which is the one almost every visit to this page is about.
 */
export const selectAllMocks = (state: RootState) => [...state.mocks.all].sort(byNewest);

/**
 * Newest first, tolerating a mock with no usable date.
 *
 * `createdAt` is written when a mock is created, but an entry stored by an older build may not
 * have one, and a comparator that returns NaN leaves the whole order undefined — one bad row was
 * enough to put the newest mock last. Undated mocks sort to the bottom instead.
 */
const byNewest = (a: MockStored, b: MockStored): number => {
  const at = createdTime(a);
  const bt = createdTime(b);

  const aUndated = Number.isNaN(at);
  const bUndated = Number.isNaN(bt);

  if (aUndated && bUndated) return 0;
  if (aUndated) return 1;
  if (bUndated) return -1;

  return bt - at;
};

const createdTime = (mock: MockStored): number =>
  mock.createdAt === undefined ? NaN : new Date(mock.createdAt).getTime();
export const selectMockById = (id: string, secret: string) => (state: RootState) =>
  state.mocks.all.find((mock) => mock.id === id && mock.secret === secret);
export const selectCountMocks = (state: RootState) => state.mocks.all.length;

export default mocksSlice.reducer;
