import '../styles.css';

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useAsync } from 'react-use';

import { remove, selectMockById } from '../../../redux/mocks/slice';
import MockyAPI from '../../../services/MockyAPI/MockyAPI';
import DeleteMockInformation from '../components/DeleteMockInformation';
import ManagerTitle from '../components/ManagerTitle';
import MockGone from '../components/MockGone';
import SearchingMockLoader from '../components/SearchingMockLoader';
import { DeleteMockParams } from '../types';
import GA from '../../../services/Analytics/GA';

const DeletionApproval = () => {
  const { id, secret }: DeleteMockParams = useParams();
  const dispatch = useDispatch();

  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Check if the mock exist in the store
  const mock = useSelector(selectMockById(id, secret));

  const state = useAsync(async () => {
    return MockyAPI.check({ id, secret });
  }, [id, secret]);

  /**
   * Delete on the server first, and only forget the mock locally once that succeeded.
   *
   * The list in the browser is the only place the id and secret are kept, so dropping the entry
   * before the request meant a failed delete left a mock alive in the database that nobody could
   * reach any more, let alone remove.
   */
  const triggerDelete = async () => {
    setDeleting(true);
    setFailed(false);

    GA.event('mock', 'delete');

    let result = false;
    try {
      result = Boolean(await MockyAPI.delete({ id, secret }));
    } catch (error) {
      console.error(`Could not delete the mock: ${error}`);
    }

    if (result) {
      dispatch(remove(id));
      setDeleted(true);
    } else {
      // The mock is still on the server, so it stays in the list with the credentials needed
      // to try again.
      setFailed(true);
    }

    setDeleting(false);
  };

  return (
    <>
      <ManagerTitle />

      <section className="text-center space--xxs">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="boxed boxed--border bg--primary boxed--lg box-shadow">
                <h3>Mock Deletion</h3>

                {(deleted && <MockGone />) ||
                  (state.loading ? (
                    <SearchingMockLoader />
                  ) : state.error ? (
                    <p>Something got wrong...</p>
                  ) : state.value ? (
                    <>
                      <p className="lead">You're about to definitively delete the following mock, are you sure?</p>
                      <DeleteMockInformation id={id} secret={secret} mock={mock} />
                      {failed && (
                        <p className="delete-failed" role="alert">
                          The mock could not be deleted and is still on the server. It is still in your list, so you
                          can try again.
                        </p>
                      )}
                      <button
                        type="submit"
                        className="btn btn--primary btn--confirmation"
                        onClick={triggerDelete}
                        disabled={deleting}
                      >
                        {failed ? 'TRY AGAIN' : 'DELETE NOW'}
                      </button>
                    </>
                  ) : (
                    <p className="lead">This mock don't exist (anymore).</p>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default DeletionApproval;
