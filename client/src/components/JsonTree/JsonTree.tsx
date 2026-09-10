import React, { useMemo, useState } from 'react';

import './styles.css';

type Json = unknown;

interface JsonTreeProps {
  value: Json;
  /** Lowercased search term; matching branches open and matching text is highlighted. */
  search?: string;
  onSelectPath?: (path: string) => void;
  /** Reports how many marks were rendered, so the toolbar can show a count. */
  onMatchCount?: (count: number) => void;
}

/**
 * A collapsible view of a JSON payload.
 *
 * A captured bid request runs to hundreds of lines, where a flat dump is unreadable: the shape is
 * what tells you where to look. Nodes therefore start folded, arrays and objects report how many
 * entries they hold, and every value carries the path that addresses it.
 */
const JsonTree = ({ value, search, onSelectPath, onMatchCount }: JsonTreeProps) => {
  const container = React.useRef<HTMLDivElement | null>(null);

  // Counting the rendered marks is what the reader actually sees, rather than a second
  // traversal that could disagree with the highlighting.
  React.useEffect(() => {
    if (!onMatchCount) return;

    onMatchCount(search ? container.current?.querySelectorAll('mark').length ?? 0 : 0);
  }, [search, value, onMatchCount]);

  return (
    <div className="jsontree" role="tree" aria-label="Request payload" ref={container}>
      <TreeNode value={value} name={null} path="" depth={0} search={search} onSelectPath={onSelectPath} />
    </div>
  );
};

interface NodeProps {
  value: Json;
  name: string | null;
  path: string;
  depth: number;
  search?: string;
  onSelectPath?: (path: string) => void;
}

const TreeNode = ({ value, name, path, depth, search, onSelectPath }: NodeProps) => {
  // Only the root is open initially; a search opens what it matches.
  const [open, setOpen] = useState(depth === 0);

  const branch = isBranch(value);
  const entries = useMemo(() => (branch ? Object.entries(value as object) : []), [branch, value]);

  // A hit deeper in the tree has to pull its ancestors open, or the match stays invisible.
  const matches = useMemo(() => (search ? subtreeMatches(value, name, search) : false), [value, name, search]);
  const expanded = open || (Boolean(search) && matches);

  if (!branch) {
    return (
      <div
        className="jt-row"
        role="treeitem"
        tabIndex={0}
        aria-level={depth + 1}
        onClick={() => onSelectPath && onSelectPath(path)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (onSelectPath) onSelectPath(path);
          }
        }}
      >
        <span className="jt-twist jt-leaf" />
        {name !== null && <span className="jt-key">{highlight(name, search)}</span>}
        {name !== null && <span className="jt-colon">: </span>}
        <span className={`jt-val jt-${typeName(value)}`}>{highlight(render(value), search)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(value);

  return (
    <div>
      <div
        className="jt-row"
        role="treeitem"
        tabIndex={0}
        aria-level={depth + 1}
        aria-expanded={expanded}
        onClick={() => onSelectPath && onSelectPath(path)}
        onKeyDown={(event) => {
          // Arrows fold and unfold, matching how a tree is expected to behave
          if (event.key === 'ArrowRight' && !expanded) {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === 'ArrowLeft' && expanded) {
            event.preventDefault();
            setOpen(false);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (onSelectPath) onSelectPath(path);
          }
        }}
      >
        <span
          className="jt-twist"
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            setOpen(!expanded);
          }}
        >
          {expanded ? '▾' : '▸'}
        </span>
        {name !== null && <span className="jt-key">{highlight(name, search)}</span>}
        {name !== null && <span className="jt-colon">: </span>}
        <span className="jt-brace">{isArray ? '[' : '{'}</span>
        {!expanded && <span className="jt-count">{entries.length} items</span>}
      </div>

      {expanded && (
        <div className="jt-kids" role="group">
          {entries.map(([key, child]) => (
            <TreeNode
              key={key}
              value={child}
              name={key}
              path={childPath(path, key, isArray)}
              depth={depth + 1}
              search={search}
              onSelectPath={onSelectPath}
            />
          ))}
        </div>
      )}

      {expanded && <div className="jt-row jt-close">{isArray ? ']' : '}'}</div>}
    </div>
  );
};

const isBranch = (value: Json): boolean => typeof value === 'object' && value !== null;

const childPath = (parent: string, key: string, inArray: boolean): string => {
  if (inArray) return `${parent}[${key}]`;
  return parent === '' ? key : `${parent}.${key}`;
};

const typeName = (value: Json): string => {
  if (value === null) return 'null';
  if (typeof value === 'number') return 'num';
  if (typeof value === 'boolean') return 'bool';
  return 'str';
};

/**
 * How much of a single value is drawn.
 *
 * A bid request carries VAST markup and signed URLs that run to tens of thousands of characters
 * on one line; laying those out unbroken blocks the tab. The full value is still available
 * through Raw and the copy actions.
 */
const MAX_VALUE_CHARS = 2000;

const render = (value: Json): string => {
  if (value === null) return 'null';

  if (typeof value === 'string') {
    return value.length > MAX_VALUE_CHARS
      ? `"${value.slice(0, MAX_VALUE_CHARS)}… (${value.length.toLocaleString()} chars)"`
      : `"${value}"`;
  }

  return String(value);
};

/** Whether this node, or anything under it, contains the term. */
const subtreeMatches = (value: Json, name: string | null, search: string): boolean => {
  if (name !== null && name.toLowerCase().includes(search)) return true;

  if (isBranch(value)) {
    return Object.entries(value as object).some(([key, child]) => subtreeMatches(child, key, search));
  }

  return render(value).toLowerCase().includes(search);
};

/**
 * Wrap every match, not only the first: a key like `maxduration` contains the term twice, and
 * marking one occurrence makes the others look like misses.
 */
const highlight = (text: string, search?: string): React.ReactNode => {
  if (!search) return text;

  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(search);

  if (at === -1) return text;

  while (at !== -1) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(<mark key={at}>{text.slice(at, at + search.length)}</mark>);
    from = at + search.length;
    at = lower.indexOf(search, from);
  }

  if (from < text.length) parts.push(text.slice(from));

  return <>{parts}</>;
};

export default JsonTree;
