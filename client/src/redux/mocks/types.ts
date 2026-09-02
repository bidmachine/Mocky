export interface MockStored {
  name?: string;
  id: string;
  secret: string;
  link: string;
  contentType: string;
  status: number;
  content?: string;
  charset: string;
  // Mocks created through the designer store the parsed object, entries saved by older
  // versions hold the raw JSON string; both shapes are read through `parseHeaders`.
  headers?: string | Record<string, unknown>;
  deleteLink: string;
  createdAt: Date;
  expireAt?: Date;
}

export interface MockState {
  last?: MockStored;
  all: Array<MockStored>;
}
