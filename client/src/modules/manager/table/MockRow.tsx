import React, { useState } from 'react';
import Moment from 'react-moment';
import CopyToClipboard from 'react-copy-to-clipboard';
import { useDispatch } from 'react-redux';
import { NavLink } from 'react-router-dom';

import {
  faChevronDown as iconCollapsed,
  faChevronUp as iconExpanded,
  faCopy as iconCopy,
  faExternalLinkAlt as iconOpen,
  faTrash as iconDelete,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { MockStored } from '../../../redux/mocks/types';
import { update as updateMock } from '../../../redux/mocks/slice';
import MockyAPI from '../../../services/MockyAPI/MockyAPI';
import GA from '../../../services/Analytics/GA';
import { absoluteMockLink } from '../../../services/url';
import CodeEditor from '../../../components/CodeEditor/CodeEditor';
import { formatBody, humanSize, isValidForContentType, parseHeaders } from '../../../services/format';

const MockRow = (props: { mock: MockStored }) => {
  const { mock } = props;
  const dispatch = useDispatch();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

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
          <NavLink to={`/manage/delete/${mock.id}/${mock.secret}`} className="icon-delete" title="Delete the mock">
            <FontAwesomeIcon icon={iconDelete} />
          </NavLink>
        </td>
      </tr>

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
