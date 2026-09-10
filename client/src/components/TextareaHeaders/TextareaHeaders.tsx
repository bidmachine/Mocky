import React from 'react';
import { FieldProps } from 'formik';
import TextareaAutosize from 'react-textarea-autosize';

const TextareaHeaders = ({ field, form: { touched, errors }, ...props }: FieldProps & { label: string }) => {
  const invalid = !!errors[field.name] && !!touched[field.name];
  let classNameError = invalid ? 'input--error' : '';

  return (
    <TextareaAutosize
      id={field.name}
      minRows={4}
      maxRows={6}
      className={`textarea--code ${classNameError}`}
      aria-invalid={invalid}
      aria-describedby={`${field.name}-help`}
      {...field}
      {...props}
    />
  );
};

export default TextareaHeaders;
