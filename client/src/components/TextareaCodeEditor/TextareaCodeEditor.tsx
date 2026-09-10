import React from 'react';
import { FieldProps } from 'formik';

import CodeEditor from '../CodeEditor/CodeEditor';
import { NewMockFormValues } from '../../modules/designer/form/types';

const TextareaCodeEditor = ({ field, form }: FieldProps<string, NewMockFormValues>) => (
  <CodeEditor
    name={field.name}
    ariaLabel="HTTP response body"
    value={field.value ?? ''}
    contentType={form.values.contentType}
    onChange={(value) => form.setFieldValue(field.name, value)}
    onBlur={() => form.setFieldTouched(field.name, true)}
  />
);

export default TextareaCodeEditor;
