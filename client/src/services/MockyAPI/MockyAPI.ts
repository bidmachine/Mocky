import { NewMockFormValues } from '../../modules/designer/form/types';
import MockyAPITransformer, { MockEdits } from './MockAPITransformer';
import HTTP from '../HTTP';
import { MockCreated, DeleteMock } from './types';
import { MockStored } from '../../redux/mocks/types';

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
};

export default MockyAPI;
