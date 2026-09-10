import { NewMockFormValues } from '../../modules/designer/form/types';
import MockyAPITransformer, { MockEdits } from './MockAPITransformer';
import HTTP from '../HTTP';
import { MockCreated, DeleteMock } from './types';
import { MockStored } from '../../redux/mocks/types';
import { CapturedPage, CapturedPageAPI, CapturedRequest, CapturedRequestAPI } from './captureTypes';

const URL = process.env.REACT_APP_API_URL + '/api/mock';

const create = async (data: NewMockFormValues): Promise<MockStored | undefined> => {
  const payload = MockyAPITransformer.formToApi(data);
  const response = await HTTP.post<MockCreated>(URL, payload);

  if (!response.data) {
    console.error(`API Response error: ${response.body}`);
    return undefined;
  } else {
    return MockyAPITransformer.createdToStore(response.data, payload);
  }
};

/**
 * Update an existing mock, keeping its id and its public link untouched.
 * The API only accepts the change if the secret of the mock is correct.
 */
const update = async (mock: MockStored, edits: MockEdits): Promise<MockStored | undefined> => {
  try {
    const payload = MockyAPITransformer.storedToUpdateApi(mock, edits);
    const updated = await HTTP.put(`${URL}/${mock.id}`, payload);

    return updated ? MockyAPITransformer.updatedToStore(mock, edits) : undefined;
  } catch (error) {
    // The API is unreachable (network error, CORS): report it as a failed update so the
    // editor can keep the pending changes instead of silently losing them
    console.error(`Mock update failed: ${error}`);
    return undefined;
  }
};

/**
 * Requests captured by a mock, newest first.
 *
 * The secret travels in the body rather than the query string: it is a credential, and query
 * strings end up in access logs and browser history.
 */
const captures = async (mock: MockStored, page = 1, perPage = 50): Promise<CapturedPage | undefined> => {
  try {
    const response = await HTTP.post<CapturedPageAPI>(`${URL}/${mock.id}/requests`, {
      secret: mock.secret,
      page,
      per_page: perPage,
    });

    if (!response.ok || !response.data) return undefined;

    return {
      items: response.data.items.map(toCapturedRequest),
      total: response.data.total,
      page: response.data.page,
      perPage: response.data.per_page,
      captureLimit: response.data.capture_limit ?? 0,
    };
  } catch (error) {
    console.error(`Could not read the captured requests: ${error}`);
    return undefined;
  }
};

/** Clear a mock's capture log, leaving the mock itself untouched. */
const clearCaptures = async (mock: MockStored): Promise<Boolean> => {
  try {
    // The endpoint answers 204, so the response body is never read
    const response = await fetch(`${URL}/${mock.id}/requests/clear`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ secret: mock.secret }),
    });

    return response.status === 204;
  } catch (error) {
    console.error(`Could not clear the captured requests: ${error}`);
    return false;
  }
};

/** Remove one captured request, leaving the rest of the log alone. */
const deleteCapture = async (mock: MockStored, captureId: string): Promise<Boolean> => {
  try {
    const response = await fetch(`${URL}/${mock.id}/requests/delete`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ secret: mock.secret, id: captureId }),
    });

    return response.status === 204;
  } catch (error) {
    console.error(`Could not delete the captured request: ${error}`);
    return false;
  }
};

/** Turn capture on or off. A limit of 0 disables it, which is how every mock starts. */
const setCapture = async (mock: MockStored, limit: number): Promise<Boolean> => {
  try {
    const response = await fetch(`${URL}/${mock.id}/capture`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      mode: 'cors',
      body: JSON.stringify({ secret: mock.secret, limit }),
    });

    return response.status === 204;
  } catch (error) {
    console.error(`Could not change the capture setting: ${error}`);
    return false;
  }
};

const toCapturedRequest = (api: CapturedRequestAPI): CapturedRequest => ({
  id: api.id,
  method: api.method,
  path: api.path,
  query: api.query ?? undefined,
  headers: api.headers,
  contentType: api.content_type ?? undefined,
  body: api.body ?? undefined,
  bodyEncoding: api.body_encoding ?? undefined,
  bodySize: api.body_size,
  truncated: api.truncated,
  receivedAt: api.received_at,
});

const _delete = async (data: DeleteMock): Promise<Boolean> => {
  return await HTTP.delete(`${URL}/${data.id}`, data);
};

const check = async (data: DeleteMock): Promise<Boolean> => {
  const response = await HTTP.post<Boolean>(`${URL}/${data.id}/check`, data);
  return response.data ?? false;
};

const MockyAPI = {
  delete: _delete,
  check,
  create,
  update,
  captures,
  clearCaptures,
  deleteCapture,
  setCapture,
};

export default MockyAPI;
