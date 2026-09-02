import React from 'react';

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
  placeholder,
  readOnly = false,
  minLines = 14,
  maxLines = 28,
  onChange,
  onBlur,
}: CodeEditorProps) => {
  const ref = React.useRef<AceEditor | null>(null);

  /**
   * A pasted response is usually minified. It is reformatted on paste, which is the moment the
   * payload arrives — typing is never reformatted under the cursor. A paste that does not parse
   * is inserted as-is, so nothing is lost.
   */
  const onPaste = (pasted: string) => {
    const editor = ref.current?.editor;
    if (!editor) return;

    editor.session.replace(editor.getSelectionRange() as any, beautifyOnPaste(pasted, contentType));
  };

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
        onPaste={onPaste}
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
        }}
      />
    </div>
  );
};

export default CodeEditor;
