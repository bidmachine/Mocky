import React, { useEffect } from 'react';

import 'ace-builds';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-github';
import AceEditor from 'react-ace';

import './styles.css';
import { beautifyOnPaste, highlightLanguage } from '../../services/format';

/**
 * Ace modes, keyed by the language detected from the content-type of the mock.
 */
const MODES: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  html: 'html',
  text: 'text',
};

interface CodeEditorProps {
  name: string;
  value: string;
  contentType: string;
  /** Accessible name for the editor's text input. */
  ariaLabel?: string;
  placeholder?: string;
  readOnly?: boolean;
  minLines?: number;
  maxLines?: number;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}

/**
 * The editor used for every mock body, both in the designer and in the management console.
 *
 * Ace owns its own height through `minLines` / `maxLines`: its height, its line-height and its
 * gutter geometry must not be set from CSS, or the gutter and the lines end up in different
 * coordinate systems and a long wrapped line becomes unreadable.
 */
const CodeEditor = ({
  name,
  value,
  contentType,
  ariaLabel,
  placeholder,
  readOnly = false,
  minLines = 14,
  maxLines = 28,
  onChange,
  onBlur,
}: CodeEditorProps) => {
  const ref = React.useRef<AceEditor | null>(null);

  // The paste listener is registered once, so the current content-type is read through a ref.
  const contentTypeRef = React.useRef(contentType);
  contentTypeRef.current = contentType;

  /**
   * A pasted response is usually minified. It is reformatted on paste, which is the moment the
   * payload arrives — typing is never reformatted under the cursor. A paste that does not parse
   * is inserted as-is, so nothing is lost.
   *
   * Ace expects a paste listener to rewrite `event.text` and inserts that text itself, so the
   * listener is attached to the editor rather than through the `onPaste` prop, which only
   * forwards the string by value: inserting the text here would leave Ace to append the
   * original, unformatted payload straight after the formatted one.
   */
  useEffect(() => {
    const editor = ref.current?.editor;
    if (!editor) return;

    const onPaste = (event: { text: string }) => {
      event.text = beautifyOnPaste(event.text, contentTypeRef.current);
    };

    editor.on('paste', onPaste as any);

    return () => editor.off('paste', onPaste as any);
  }, []);

  return (
    <div className="editor--code">
      <AceEditor
        ref={ref}
        mode={MODES[highlightLanguage(contentType)]}
        theme="github"
        name={name}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={onChange}
        onBlur={onBlur}
        width="100%"
        minLines={minLines}
        maxLines={maxLines}
        wrapEnabled
        setOptions={{
          printMargin: false,
          useWorker: false,
          tabSize: 2,
          highlightActiveLine: !readOnly,
          highlightGutterLine: !readOnly,
          // Ace renders its own hidden textarea, so its accessible name is set here rather than
          // through a `<label htmlFor>`, which has no stable id to point at.
          textInputAriaLabel: ariaLabel ?? name,
        }}
      />
    </div>
  );
};

export default CodeEditor;
