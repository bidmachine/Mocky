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
  const [copied, setCopied] = useState<'raw' | 'json' | undefined>(undefined);

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
    if (await MockyAPI.clearCaptures(mock)) {
      setItems([]);
    } else {
      setError('Could not clear the captured requests.');
    }
  };

  const current = items[selected];

  const remember = (what: 'raw' | 'json') => {
    setCopied(what);
    window.setTimeout(() => setCopied(undefined), 1400);
  };

  /** The payload formatted, which is what the reader is looking at. */
  const copyJson = (request: CapturedRequest) => {
    copyText(prettify(request));
    remember('json');
  };

  /** The payload byte for byte as it arrived, for pasting somewhere that must match exactly. */
  const copyRaw = (request: CapturedRequest) => {
    copyText(request.body ?? '');
    remember('raw');
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
            <button type="button" className="btn btn--sm" onClick={clear} disabled={items.length === 0}>
              Clear log
            </button>
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
            <div className="captures-hint">Turn it on and the next calls to this URL will show up here.</div>
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
                <span className="capture-when">{clockOf(item.receivedAt)}</span>
                {item.truncated && <span className="capture-trunc">truncated</span>}
              </button>
            ))}
          </div>

          <div className="captures-detail">
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

                <pre className="capture-headers">
                  {`${current.method} ${current.path}${current.query ? `?${current.query}` : ''}\n`}
                  {Object.entries(current.headers)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n')}
                </pre>

                {current.body === undefined && <div className="captures-empty">No request body.</div>}

                {current.body !== undefined && (
                  <>
                    <div className="capture-tools">
                      <button
                        type="button"
                        className={`btn btn--sm ${raw ? '' : 'btn--primary'}`}
                        onClick={() => setRaw(false)}
                      >
                        Tree
                      </button>
                      <button
                        type="button"
                        className={`btn btn--sm ${raw ? 'btn--primary' : ''}`}
                        onClick={() => setRaw(true)}
                      >
                        Raw
                      </button>
                      <input
                        type="text"
                        className="capture-find"
                        placeholder="find: bidfloor, imp…"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      <span className="capture-copy">
                        <button type="button" className="btn btn--sm" onClick={() => copyJson(current)}>
                          {copied === 'json' ? 'Copied' : 'Copy JSON'}
                        </button>
                        <button type="button" className="btn btn--sm" onClick={() => copyRaw(current)}>
                          {copied === 'raw' ? 'Copied' : 'Copy raw'}
                        </button>
                      </span>
                    </div>

                    {path && <div className="capture-path-bar">{path}</div>}

                    {raw || parseJson(current.body) === undefined ? (
                      <pre className="capture-raw">{prettify(current)}</pre>
                    ) : (
                      <JsonTree
                        value={parseJson(current.body)}
                        search={search.trim().toLowerCase() || undefined}
                        onSelectPath={setPath}
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

/** Undefined when the body is not JSON, which sends the viewer to the raw view. */
const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch (e) {
    return undefined;
  }
};

export default CapturedRequests;
