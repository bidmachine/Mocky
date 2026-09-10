import React from 'react';
import { Field } from 'formik';

const SelectExpirationTime = (props: { name: string }) => {
  const { name } = props;

  return (
    <Field as="select" component="select" name={name} id={name} aria-describedby="expiration-help">
      <option value="never">Never</option>
      <option value="1year">After 1 year</option>
      <option value="1month">After 1 month</option>
      <option value="2weeks">After 2 weeks</option>
      <option value="1week">After 1 week</option>
      <option value="1day">After 1 day</option>
    </Field>
  );
};

export default SelectExpirationTime;
