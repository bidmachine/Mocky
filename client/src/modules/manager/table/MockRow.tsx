import React, { useState } from 'react';
import Moment from 'react-moment';
import CopyToClipboard from 'react-copy-to-clipboard';
import { useDispatch } from 'react-redux';
import { NavLink } from 'react-router-dom';

import {
  faChevronDown as iconCollapsed,
  faChevronUp as iconExpanded,
  faCopy as iconCopy,
  faEdit as iconEdit,
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
import { formatBody, humanSize, isValidForContentType } from '../../../services/format';

const MockRow = (props: { mock: MockStored }) => {
  const { mock } = props;
  const dispatch = useDispatch();

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const link = absoluteMockLink(mock.link);
  const body = mock.content ?? '';
  const headers = parseHeaders(mock.headers);

  const startEditing = () => {
    setDraft(formatBody(body, mock.contentType));
    setNameDraft(mock.name ?? '');
    setError(undefined);
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(undefined);
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);

    const updated = await MockyAPI.update(mock, { content: draft, name: nameDraft });

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
    setEditing(false);
  };

  // A JSON mock that no longer parses would still be served as-is, so warn before saving it
  const invalidJson = editing && !isValidForContentType(draft, mock.contentType);

  return (
    <>
      <tr className="mock-row">
        <td>
          <button
            type="button"
            className="btn-expand"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide the details' : 'Show the details'}>
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

            {!editing && (
              <div className="mock-body-header">
                <span className="mock-field-label">Response body</span>
                <button type="button" className="btn btn--sm btn--primary" onClick={startEditing}>
                  <FontAwesomeIcon icon={iconEdit} />
                  &nbsp;Edit
                </button>
              </div>
            )}

            {!editing &&
              (body === '' ? (
                <div className="mock-empty">(empty body)</div>
              ) : (
                <CodeEditor
                  name={`preview-${mock.id}`}
                  value={formatBody(body, mock.contentType)}
                  contentType={mock.contentType}
                  readOnly
                  minLines={3}
                  maxLines={20}
                />
              ))}

            {editing && (
              <div className="mock-editor">
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
                  <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn" onClick={cancelEditing} disabled={saving}>
                    Cancel
                  </button>
                  <small className="type--fade">The mock URL does not change.</small>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

/**
 * Headers are stored as a raw JSON string. A body that cannot be parsed is simply not displayed,
 * because the preview must never break the whole list.
 */
const parseHeaders = (headers?: string): [string, string][] => {
  if (!headers || headers.trim() === '') return [];

  try {
    const parsed = JSON.parse(headers);
    if (typeof parsed !== 'object' || parsed === null) return [];
    return Object.entries(parsed).map(([key, value]) => [key, String(value)]);
  } catch (e) {
    return [];
  }
};

const statusColor = (status: number): string => {
  if (status < 300) return 'badge-success';
  if (status < 400) return 'badge-info';
  if (status < 500) return 'badge-warning';
  return 'badge-danger';
};

export default MockRow;
