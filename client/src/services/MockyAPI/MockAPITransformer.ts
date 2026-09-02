import { NewMockFormValues } from '../../modules/designer/form/types';
import Random from 'randomstring';
import { MockCreated, MockCreateAPI } from './types';
import { MockStored } from '../../redux/mocks/types';

/**
 * Fields of a mock that can be edited from the management console.
 * An omitted field keeps its current value.
 */
export interface MockEdits {
  content?: string;
  name?: string;
}

/**
 * Transform Mock form data to the payload expected by the API
 */
const formToApi = (data: NewMockFormValues): MockCreateAPI => {
  const headers = data.headers && data.headers !== '' ? JSON.parse(data.headers) : undefined;
  const secret = data.secret && data.secret !== '' ? data.secret : Random.generate(36);
  const content = data.body && data.body !== '' ? data.body : undefined;
  const name = data.name && data.name !== '' ? data.name : undefined;

  return {
    status: data.status,
    content: content,
    content_type: data.contentType,
    charset: data.charset,
    secret: secret,
    name: name,
    expiration: data.expiration,
    headers: headers,
  };
};

/**
 * Construct from mock API response and mock API request the data to store in the local-storage
 * for future usage
 */
const createdToStore = (created: MockCreated, data: MockCreateAPI): MockStored => {
  const { name, content_type, status, content, charset, headers } = data;

  const deleteLink = `${process.env.REACT_APP_DOMAIN}/manage/delete/${created.id}/${created.secret}`;
  const createdAt = new Date();

  return { ...created, name, status, content, charset, headers, contentType: content_type, deleteLink, createdAt };
};

/**
 * Build the payload of a mock update (`PUT /api/mock/:id`).
 *
 * The API replaces the whole mock, so every field has to be sent back, not only the edited ones.
 * `expiration` is part of that payload and the API recomputes `expire_at` from it, so the current
 * expiration is sent again to keep an edit from silently changing when the mock expires.
 */
const storedToUpdateApi = (mock: MockStored, edits: MockEdits): MockCreateAPI => {
  const content = edits.content ?? mock.content ?? '';
  const name = (edits.name ?? mock.name ?? '').trim();

  return {
    status: mock.status,
    content: content !== '' ? content : undefined,
    content_type: mock.contentType,
    charset: mock.charset,
    secret: mock.secret,
    name: name !== '' ? name : undefined,
    expiration: currentExpiration(mock),
    headers: mock.headers && mock.headers !== '' ? JSON.parse(mock.headers) : undefined,
  };
};

/**
 * Map the stored `expireAt` date back to the `expiration` value expected by the API.
 * Mocks are almost always created with `never`; for the other ones the closest remaining
 * duration is used so that editing does not extend nor shorten the lifetime more than needed.
 */
const currentExpiration = (mock: MockStored): string => {
  if (!mock.expireAt) return 'never';

  const remainingDays = (new Date(mock.expireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (remainingDays <= 1) return '1day';
  if (remainingDays <= 7) return '1week';
  if (remainingDays <= 31) return '1month';
  return '1year';
};

/**
 * Apply the edited fields on the mock kept in the local-storage
 */
const updatedToStore = (mock: MockStored, edits: MockEdits): MockStored => {
  const content = edits.content ?? mock.content ?? '';
  const name = (edits.name ?? mock.name ?? '').trim();

  return {
    ...mock,
    content: content !== '' ? content : undefined,
    name: name !== '' ? name : undefined,
  };
};

const MockyAPITransformer = {
  formToApi,
  createdToStore,
  storedToUpdateApi,
  updatedToStore,
};

export default MockyAPITransformer;
