import React from 'react';
import { FieldProps } from 'formik';

import 'ace-builds';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-xml';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-text';
import 'ace-builds/src-noconflict/theme-github';
import AceEditor from 'react-ace';

import './styles.css';
import { beautifyOnPaste, highlightLanguage } from '../../services/format';
import { NewMockFormValues } from '../../modules/designer/form/types';

const placeholder = JSON.stringify(
  {
    identity: {
      id: 'b06cd03f-75d0-413a-b94b-35e155444d70',
      login: 'John Doe',
    },
    permissions: { roles: ['moderator'] },
  },
  null,
  2
);

/**
 * Ace modes, keyed by the language detected from the content-type of the mock.
 */
const MODES: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  html: 'html',
  text: 'text',
};

const TextareaCodeEditor = ({ field, form }: FieldProps<string, NewMockFormValues>) => {
  const contentType = form.values.contentType;

  /**
   * A pasted response is usually minified. It is reformatted on paste so that it is readable
   * right away, which is the moment the payload arrives — typing is never reformatted under
   * the cursor. A paste that does not parse is inserted as-is, so nothing is lost.
   */
  const onPaste = (pasted: string) => {
    const editor = ref.current?.editor;
    if (!editor) return;

    editor.session.replace(editor.getSelectionRange() as any, beautifyOnPaste(pasted, contentType));
  };

  const ref = React.useRef<AceEditor | null>(null);

  return (
    <div className="editor--code">
      <AceEditor
        ref={ref}
        mode={MODES[highlightLanguage(contentType)]}
        theme="github"
        name={field.name}
        value={field.value ?? ''}
        placeholder={placeholder}
        onChange={(value: string) => form.setFieldValue(field.name, value)}
        onBlur={() => form.setFieldTouched(field.name, true)}
        onPaste={onPaste}
        width="100%"
        // Ace owns its own height through these: never size it from CSS, or its
        // scroll geometry and its gutter drift apart on a long wrapped line.
        minLines={14}
        maxLines={28}
        wrapEnabled
        setOptions={{
          printMargin: false,
          useWorker: false,
          tabSize: 2,
        }}
      />
    </div>
  );
};

export default TextareaCodeEditor;
