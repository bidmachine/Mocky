import React, { useCallback } from 'react';
import { FieldProps } from 'formik';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { Editor } from 'codemirror';

import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/display/placeholder';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/foldgutter.css';

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
 * CodeMirror modes, keyed by the language detected from the content-type of the mock.
 */
const MODES: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  html: 'htmlmixed',
  text: 'text/plain',
};

const TextareaCodeEditor = ({ field, form }: FieldProps<string, NewMockFormValues>) => {
  const contentType = form.values.contentType;
  const mode = MODES[highlightLanguage(contentType)];

  /**
   * A pasted response is usually minified. It is reformatted on paste so that it is readable
   * right away, which is the moment the payload arrives — typing is never reformatted under
   * the cursor.
   */
  const onPaste = useCallback(
    (editor: Editor, event: ClipboardEvent) => {
      const pasted = event.clipboardData?.getData('text') ?? '';
      const beautified = beautifyOnPaste(pasted, contentType);

      // Only take over the paste when formatting actually changed something, so that a
      // plain paste keeps the native behaviour (and its undo history).
      if (beautified === pasted) return;

      event.preventDefault();
      editor.replaceSelection(beautified);
    },
    [contentType]
  );

  return (
    <CodeMirror
      value={field.value ?? ''}
      className="editor--code"
      options={{
        mode,
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        // `placeholder` comes from the display/placeholder addon, which the typings do not cover
        ...({ placeholder } as {}),
      }}
      onBeforeChange={(editor, data, value) => form.setFieldValue(field.name, value)}
      onBlur={() => form.setFieldTouched(field.name, true)}
      onPaste={onPaste}
    />
  );
};

export default TextareaCodeEditor;
