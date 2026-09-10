import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import JsonTree from '../../../components/JsonTree/JsonTree';
import MockyAPI from '../../../services/MockyAPI/MockyAPI';
import { CapturedRequest } from '../../../services/MockyAPI/captureTypes';
import { setCaptureLimit } from '../../../redux/mocks/slice';
import { MockStored } from '../../../redux/mocks/types';
import { formatBody, humanSize } from '../../../services/format';

/** What a mock keeps once capture is switched on. */
const DEFAULT_LIMIT = 100;

/**
 * How much of a body is rendered at once.
 *
 * A captured payload can be 64 KB on a single line with no whitespace — laying that out means
 * the browser hunting for break opportunities character by character, which froze the tab for
 * four seconds on click. The rest stays one button away.
 */
const PREVIEW_CHARS = 20000;

/** How often an open tab re-reads the log while capture is on. */
const POLL_MS = 3000;

const CapturedRequests = (props: { mock: MockStored }) => {
  const { mock } = props;
  const dispatch = useDispatch();

  const [items, setItems] = useState<CapturedRequest[]>([]);
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);
  selectedRef.current = selected;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [path, setPath] = useState<string | undefined>(undefined);
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState<'body' | 'path' | undefined>(undefined);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [showWhole, setShowWhole] = useState(false);
  const [matches, setMatches] = useState(0);
  const [atMatch, setAtMatch] = useState(0);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const enabled = (mock.captureLimit ?? 0) > 0;

  const load = useCallback(
    async (options: { quiet?: boolean } = {}) => {
      if (!options.quiet) setLoading(true);
      setError(undefined);

      const page = await MockyAPI.captures(mock);

      if (!options.quiet) setLoading(false);

      if (page === undefined) {
        setError(
          'Could not read the captured requests. The mock may no longer exist on the server, or the API is unreachable.'
        );
        return;
      }

      setItems((previous) => {
        // Keep whatever the reader is looking at pinned when a poll brings newer requests in
        if (!options.quiet) {
          setSelected(0);
        } else if (previous[selectedRef.current]) {
          const stillThere = page.items.findIndex(
            (item) => item.receivedAt === previous[selectedRef.current].receivedAt
          );
          setSelected(stillThere === -1 ? 0 : stillThere);
        }

        return page.items;
      });
    },
    [mock]
  );

  // The manager has never read from the server before, so this is the one place that fetches.
  // The log is loaded even when capture is off: earlier requests are still worth reading.
  useEffect(() => {
    load();
  }, [load]);

  /**
   * While capture is on, new requests appear on their own rather than behind a Refresh press:
   * the point of watching a log is seeing calls land as a test run makes them.
   *
   * A poll is enough here — the server has no push channel, and one small read every few seconds
   * costs less than the streaming setup it would take to avoid it.
   */
  useEffect(() => {
    if (!enabled) return undefined;

    const timer = window.setInterval(() => {
      if (!document.hidden) load({ quiet: true });
    }, POLL_MS);

    // A hidden tab is not polled — there is no one reading it — so catch up on return rather
    // than leaving the reader looking at a list that stopped where they left it.
    const onVisible = () => {
      if (!document.hidden) load({ quiet: true });
    };

    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, load]);

  const toggle = async () => {
    const limit = enabled ? 0 : DEFAULT_LIMIT;

    if (await MockyAPI.setCapture(mock, limit)) {
      dispatch(setCaptureLimit({ id: mock.id, limit }));
      // Switching capture off only stops new records — what was already collected stays readable
      load();
    } else {
      // A 404 here means the mock is in this browser's list but not on the server — the usual
      // cause is a mock deleted elsewhere, or a database this browser has outlived.
      setError('This mock no longer exists on the server, so capture cannot be changed for it.');
    }
  };

  const clear = async () => {
    setConfirmingClear(false);

    if (await MockyAPI.clearCaptures(mock)) {
      setItems([]);
    } else {
      setError('Could not delete the captured requests.');
    }
  };

  /** Remove one request; the rest of the log, and the mock, are untouched. */
  const deleteOne = async (request: CapturedRequest) => {
    if (!(await MockyAPI.deleteCapture(mock, request.id))) {
      setError('Could not delete that request.');
      return;
    }

    setItems((previous) => {
      const remaining = previous.filter((item) => item.id !== request.id);
      setSelected((current) => Math.min(current, Math.max(remaining.length - 1, 0)));
      return remaining;
    });
  };

  const current = items[selected];

  /**
   * Step through the highlighted matches and scroll each one into view.
   *
   * Without this a search reports hits that are thousands of pixels down the pane, which reads
   * as a search that found nothing.
   */
  const goToMatch = (index: number) => {
    const marks = detailRef.current?.querySelectorAll('mark');
    if (!marks || marks.length === 0) return;

    const next = ((index % marks.length) + marks.length) % marks.length;
    setAtMatch(next);
    marks[next].scrollIntoView({ block: 'center' });
  };

  // A body that is not JSON has no tree and cannot be searched, so the controls that imply
  // otherwise are disabled rather than left offering something that does nothing.
  const parsed = current?.body !== undefined ? parseJson(current.body) : undefined;
  const isJson = parsed !== undefined;
  const showRaw = raw || !isJson;

  const remember = (what: 'body' | 'path') => {
    setCopied(what);
    window.setTimeout(() => setCopied(undefined), 1400);
  };

  /**
   * Copy whatever the switch is showing: the formatted payload in Tree, the bytes as they
   * arrived in Raw. Two buttons made the reader decide which one they wanted, when the view
   * they had already chosen answers that.
   */
  const copyBody = (request: CapturedRequest, formatted: boolean) => {
    copyText(formatted ? prettify(request) : request.body ?? '');
    remember('body');
  };

  return (
    <div className="captures">
      <div className="captures-bar">
        <button
          type="button"
          className={`capture-switch ${enabled ? 'on' : ''}`}
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
        >
          <span className="capture-track">
            <span className="capture-knob" />
          </span>
          Capture requests
        </button>

        <span className="capture-meta">
          {enabled
            ? `${items.length} / ${mock.captureLimit} · kept 7 days`
            : items.length > 0
            ? `off · ${items.length} kept`
            : 'off'}
        </span>

        {(enabled || items.length > 0) && (
          <span className="capture-actions">
            <button type="button" className="btn btn--sm" onClick={() => load()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {confirmingClear ? (
              <>
                <button type="button" className="btn btn--sm btn--danger" onClick={clear}>
                  Delete {items.length} {items.length === 1 ? 'request' : 'requests'}
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setConfirmingClear(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => setConfirmingClear(true)}
                disabled={items.length === 0}
              >
                Delete all
              </button>
            )}
          </span>
        )}
      </div>

      {error && <div className="mock-error">{error}</div>}

      {items.length === 0 && !loading && (
        <div className="captures-empty">
          <div>{enabled ? 'No requests captured yet.' : 'Capture is off for this mock.'}</div>
          {enabled ? (
            <code className="captures-cmd">curl -X POST {mock.link} -d '&#123;"ping":1&#125;'</code>
          ) : (
            <>
              <div className="captures-hint">Requests to this URL are not being recorded.</div>
              <button type="button" className="btn btn--primary btn--sm" onClick={toggle}>
                Start capturing
              </button>
            </>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="captures-split">
          <div className="captures-list">
            {items.map((item, index) => (
              <button
                type="button"
                key={`${item.receivedAt}-${index}`}
                className={`capture-row ${index === selected ? 'on' : ''}`}
                onClick={() => {
                  setSelected(index);
                  setPath(undefined);
                }}
              >
                <span className={`capture-method m-${item.method}`}>{item.method}</span>
                <span className="capture-path">
                  {item.path}
                  {item.query ? `?${item.query}` : ''}
                </span>
                <span className="capture-size">{humanSize(item.body)}</span>
                <span className="capture-when">{clockOf(item.receivedAt)}</span>
                {item.truncated && (
                  <span className="capture-trunc" title="Body was truncated">
                    !
                  </span>
                )}
                <span
                  className="capture-del"
                  role="button"
                  tabIndex={0}
                  title="Delete this request"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteOne(item);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      deleteOne(item);
                    }
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>

          <div className="captures-detail" ref={detailRef}>
            {current && (
              <>
                <div className="capture-when-bar">
                  <span className="mock-field-label">Received</span>
                  <span>{current.receivedAt.replace('T', ' ').replace('Z', ' UTC')}</span>
                  <span className="mock-field-label">Size</span>
                  <span>{humanSize(current.body)}</span>
                  {current.truncated && (
                    <span className="capture-trunc">
                      first {humanSize(current.body)} of {current.bodySize} bytes
                    </span>
                  )}
                </div>

                <details className="capture-headers-box">
                  <summary>
                    {Object.keys(current.headers).length} headers
                    {current.contentType ? ` · ${current.contentType}` : ''}
                  </summary>
                  <pre className="capture-headers">
                    {`${current.method} ${current.path}${current.query ? `?${current.query}` : ''}\n`}
                    {Object.entries(current.headers)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join('\n')}
                  </pre>
                </details>

                {current.body === undefined && <div className="captures-empty">No request body.</div>}

                {current.body !== undefined && (
                  <>
                    <div className="capture-tools">
                      <div
                        className={`view-switch ${showRaw ? 'raw' : 'tree'} ${isJson ? '' : 'disabled'}`}
                        role="radiogroup"
                        aria-label="Payload view"
                        title={isJson ? undefined : 'This body is not JSON, so there is no tree to show'}
                      >
                        {/* The thumb slides between the two halves; the labels sit above it */}
                        <span className="view-switch-thumb" aria-hidden="true" />
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!showRaw}
                          className="view-switch-option"
                          onClick={() => setRaw(false)}
                          disabled={!isJson}
                        >
                          Tree
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={showRaw}
                          className="view-switch-option"
                          onClick={() => setRaw(true)}
                        >
                          Raw
                        </button>
                      </div>
                      <input
                        type="text"
                        className="capture-find"
                        aria-label="Search payload"
                        placeholder={isJson ? 'find: bidfloor, imp…' : 'not searchable — raw body'}
                        value={search}
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setAtMatch(0);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            goToMatch(event.shiftKey ? atMatch - 1 : atMatch + 1);
                          }
                        }}
                        disabled={!isJson}
                      />
                      {search.trim() !== '' && isJson && (
                        <span className="capture-matches" role="status">
                          {matches === 0 ? 'no matches' : `${atMatch + 1} of ${matches}`}
                        </span>
                      )}
                      <span className="capture-copy">
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => copyBody(current, !showRaw)}
                          title={showRaw ? 'Copy the body as it arrived' : 'Copy the formatted payload'}
                        >
                          {copied === 'body' ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    </div>

                    <div className="capture-path-bar">
                      {path ? (
                        <button
                          type="button"
                          className="capture-path-copy"
                          title="Copy this path"
                          onClick={() => {
                            copyText(path);
                            remember('path');
                          }}
                        >
                          <span className="capture-path-text">{path}</span>
                          <span className="capture-path-hint">{copied === 'path' ? 'copied' : 'copy'}</span>
                        </button>
                      ) : (
                        <span className="capture-path-empty">select a node to get its path</span>
                      )}
                    </div>

                    {showRaw ? (
                      <>
                        <pre className="capture-raw">{clipped(prettify(current), showWhole)}</pre>
                        {isClipped(prettify(current), showWhole) && (
                          <div className="capture-clip">
                            Showing the first {PREVIEW_CHARS.toLocaleString()} of{' '}
                            {prettify(current).length.toLocaleString()} characters.
                            <button type="button" className="btn btn--sm" onClick={() => setShowWhole(true)}>
                              Show all
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <JsonTree
                        value={parsed}
                        search={search.trim().toLowerCase() || undefined}
                        onSelectPath={setPath}
                        onMatchCount={setMatches}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Time of day with milliseconds — the part that matters when comparing calls in a test run. */
const clockOf = (iso: string): string => {
  const date = new Date(iso);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');

  return (
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}` +
    `.${pad(date.getUTCMilliseconds(), 3)}`
  );
};

/**
 * The raw view is pretty-printed too: a captured bid request arrives minified, and a single
 * 5000-character line is no more readable here than it is in the tree.
 */
const prettify = (request: CapturedRequest): string =>
  request.body === undefined ? '' : formatBody(request.body, request.contentType ?? '');

const copyText = (text: string) => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }
};

const isClipped = (text: string, showWhole: boolean): boolean => !showWhole && text.length > PREVIEW_CHARS;

const clipped = (text: string, showWhole: boolean): string =>
  isClipped(text, showWhole) ? text.slice(0, PREVIEW_CHARS) : text;

/** Undefined when the body is not JSON, which sends the viewer to the raw view. */
const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch (e) {
    return undefined;
  }
};

export default CapturedRequests;
