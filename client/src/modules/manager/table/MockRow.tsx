import React, { useState } from 'react';
import Moment from 'react-moment';
import CopyToClipboard from 'react-copy-to-clipboard';
import { useDispatch } from 'react-redux';

import {
  faChevronDown as iconCollapsed,
  faChevronUp as iconExpanded,
  faCopy as iconCopy,
  faExternalLinkAlt as iconOpen,
  faTrash as iconDelete,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { MockStored } from '../../../redux/mocks/types';
import { remove as removeMock, update as updateMock } from '../../../redux/mocks/slice';
import MockyAPI from '../../../services/MockyAPI/MockyAPI';
import GA from '../../../services/Analytics/GA';
import { absoluteMockLink } from '../../../services/url';
import CodeEditor from '../../../components/CodeEditor/CodeEditor';
import CapturedRequests from './CapturedRequests';
import { formatBody, humanSize, isValidForContentType, parseHeaders } from '../../../services/format';

const MockRow = (props: { mock: MockStored }) => {
  const { mock } = props;
  const dispatch = useDispatch();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'response' | 'requests'>('response');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  // The row is always editable once expanded, so the drafts start from what the mock holds.
  const [draft, setDraft] = useState(() => formatBody(mock.content ?? '', mock.contentType));
  const [nameDraft, setNameDraft] = useState(mock.name ?? '');

  // What is currently stored, in the same shape as the drafts, so the two can be compared.
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    body: formatBody(mock.content ?? '', mock.contentType),
    name: mock.name ?? '',
  }));

  const link = absoluteMockLink(mock.link);
  const headers = parseHeaders(mock.headers);

  // Saving is only offered once something actually differs from what is stored, so an
  // expanded row that was only read never looks like it has pending changes.
  const isDirty = draft !== savedSnapshot.body || nameDraft !== savedSnapshot.name;

  const reset = () => {
    setDraft(savedSnapshot.body);
    setNameDraft(savedSnapshot.name);
    setError(undefined);
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);

    // The body is only sent when it was actually edited: the draft is pretty-printed, so
    // sending it after a rename alone would silently rewrite the stored response bytes.
    const bodyChanged = draft !== savedSnapshot.body;

    const updated = await MockyAPI.update(mock, {
      content: bodyChanged ? draft : undefined,
      name: nameDraft,
    });

    setSaving(false);

    if (updated === undefined) {
      setError(
        'The mock could not be updated. It may have been deleted, its secret may no longer be valid, ' +
          'or the API is unreachable. Your changes are kept here.'
      );
      return;
    }

    GA.event('mock', 'update');
    dispatch(updateMock(updated));

    // The draft is what was just saved, so it becomes the new baseline: comparing against the
    // freshly stored mock would keep the row dirty, since the draft is formatted and the mock
    // holds the body exactly as it was sent.
    setDraft(draft);
    setNameDraft(nameDraft.trim());
    setSavedSnapshot({ body: draft, name: nameDraft.trim() });
  };

  // A JSON mock that no longer parses would still be served as-is, so warn before saving it
  const invalidJson = isDirty && !isValidForContentType(draft, mock.contentType);

  /**
   * Delete the mock from the row it sits in.
   *
   * This used to take the reader to a page of its own, which is still there for the secret
   * delete link — someone opening that link a week later has no row to click. From the list,
   * where the mock is right in front of them, a page is three steps for one decision.
   *
   * The server goes first: the list in this browser is the only copy of the id and secret, so
   * forgetting the mock before the request succeeds would leave it alive and unreachable.
   */
  const remove = async () => {
    setDeleting(true);
    setDeleteFailed(false);

    GA.event('mock', 'delete');

    let deleted = false;
    try {
      deleted = Boolean(await MockyAPI.delete({ id: mock.id, secret: mock.secret }));
    } catch (problem) {
      console.error(`Could not delete the mock: ${problem}`);
    }

    setDeleting(false);

    if (deleted) {
      dispatch(removeMock(mock.id));
    } else {
      setDeleteFailed(true);
    }
  };

  return (
    <>
      <tr className="mock-row">
        <td>
          <button
            type="button"
            className="btn-expand"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide the details' : 'Show the details'}
          >
            <FontAwesomeIcon icon={expanded ? iconExpanded : iconCollapsed} />
          </button>
        </td>

        <td className="mock-name">
          <span>{mock.name || mock.id}</span>
          <br />
          <small className="type--fade">
            <Moment format="YYYY-MM-DD HH:mm" withTitle date={mock.createdAt} />
          </small>
        </td>

        <td className="mock-badges">
          <span className={`badge ${statusColor(mock.status)}`}>{mock.status}</span>&nbsp;
          <span className="badge badge-info">{mock.contentType}</span>&nbsp;
          <span className="badge badge-light">{humanSize(mock.content)}</span>
          {!mock.content && (
            <>
              &nbsp;<span className="badge badge-light">NO CONTENT</span>
            </>
          )}
        </td>

        <td className="mock-actions">
          <CopyToClipboard text={link} onCopy={() => setCopied(true)}>
            <button type="button" className="btn-icon" title={copied ? 'Link copied!' : 'Copy the mock URL'}>
              <FontAwesomeIcon icon={iconCopy} />
            </button>
          </CopyToClipboard>
          &nbsp;
          <a href={link} target="_blank" rel="noopener noreferrer" title="Open the mock in a new tab">
            <FontAwesomeIcon icon={iconOpen} />
          </a>
          &nbsp;
          <button
            type="button"
            className="btn-icon icon-delete"
            title="Delete the mock"
            onClick={() => {
              setDeleteFailed(false);
              setConfirmingDelete(true);
            }}
          >
            <FontAwesomeIcon icon={iconDelete} />
          </button>
        </td>
      </tr>

      {confirmingDelete && (
        <tr className="mock-confirm-row">
          <td colSpan={4}>
            <div className="mock-confirm" role="alertdialog" aria-label="Delete this mock">
              <div className="mock-confirm__text">
                <strong>Delete {mock.name ? `"${mock.name}"` : 'this mock'}?</strong>
                <span>
                  Its URL stops working, and anything it captured goes with it. This cannot be undone.
                </span>
                {deleteFailed && (
                  <span className="mock-confirm__error" role="alert">
                    The mock could not be deleted, so it is still on the server and still in your list.
                  </span>
                )}
              </div>
              <div className="mock-confirm__actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={remove} disabled={deleting}>
                  {deleting ? 'Deleting…' : deleteFailed ? 'Try again' : 'Delete'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}

      {expanded && (
        <tr className="mock-details">
          <td colSpan={4}>
            <div className="mock-url">
              <a href={link} target="_blank" rel="noopener noreferrer">
                {link}
              </a>
            </div>

            {headers.length > 0 && (
              <div className="mock-headers">
                {headers.map(([key, value]) => (
                  <div key={key}>
                    <span className="header-key">{key}</span>: <span className="header-value">{value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mock-tabs">
              <button
                type="button"
                className={`mock-tab ${tab === 'response' ? 'on' : ''}`}
                onClick={() => setTab('response')}
              >
                Response
              </button>
              <button
                type="button"
                className={`mock-tab ${tab === 'requests' ? 'on' : ''}`}
                onClick={() => setTab('requests')}
              >
                Requests
              </button>
            </div>

            {tab === 'requests' && <CapturedRequests mock={mock} />}

            <div hidden={tab !== 'response'}>
              <label className="mock-field">
                <span className="mock-field-label">Name</span>
                <input
                  type="text"
                  className="form-control"
                  value={nameDraft}
                  disabled={saving}
                  maxLength={100}
                  placeholder="A name to identify this mock"
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </label>

              <span className="mock-field-label">Response body</span>

              <CodeEditor
                name={`edit-${mock.id}`}
                value={draft}
                contentType={mock.contentType}
                readOnly={saving}
                minLines={6}
                maxLines={24}
                onChange={setDraft}
              />

              {invalidJson && (
                <div className="mock-warning">
                  This body is not valid JSON, but the mock is served as <code>{mock.contentType}</code>.
                </div>
              )}

              {error && <div className="mock-error">{error}</div>}

              <div className="mock-editor-actions">
                <button type="button" className="btn btn--primary" onClick={save} disabled={!isDirty || saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn" onClick={reset} disabled={!isDirty || saving}>
                  Reset
                </button>
                <small className="type--fade">
                  {isDirty ? 'Unsaved changes. The mock URL does not change.' : 'The mock URL does not change.'}
                </small>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const statusColor = (status: number): string => {
  if (status < 300) return 'badge-success';
  if (status < 400) return 'badge-info';
  if (status < 500) return 'badge-warning';
  return 'badge-danger';
};

export default MockRow;
