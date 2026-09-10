import React from 'react';
import { FieldProps } from 'formik';

import CodeEditor from '../CodeEditor/CodeEditor';
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

const TextareaCodeEditor = ({ field, form }: FieldProps<string, NewMockFormValues>) => (
  <CodeEditor
    name={field.name}
    ariaLabel="HTTP response body"
    value={field.value ?? ''}
    contentType={form.values.contentType}
    placeholder={placeholder}
    onChange={(value) => form.setFieldValue(field.name, value)}
    onBlur={() => form.setFieldTouched(field.name, true)}
  />
);

export default TextareaCodeEditor;
