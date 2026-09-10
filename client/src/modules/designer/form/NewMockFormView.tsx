import './styles.css';

import { ErrorMessage, FastField, Form, FormikProps } from 'formik';
import React from 'react';

import SelectCharset from '../../../components/SelectCharset/SelectCharset';
import SelectContentType from '../../../components/SelectContentType/SelectContentType';
import SelectExpirationTime from '../../../components/SelectExpirationTime/SelectExpirationTime';
import SelectHttpStatusCode from '../../../components/SelectHttpStatusCode/SelectHttpStatusCode';
import TextareaCodeEditor from '../../../components/TextareaCodeEditor/TextareaCodeEditor';
import TextareaHeaders from '../../../components/TextareaHeaders/TextareaHeaders';
import CleanConfirmationOnSubmit from './CleanConfirmationOnSubmit';
import { NewMockFormValues } from './types';

const NewMockFormView = (props: FormikProps<NewMockFormValues>) => {
  const { touched, errors, isSubmitting, submitCount, isValid, values } = props;
  const errorAlert = React.useRef<HTMLDivElement | null>(null);

  /*
   * An empty body is legitimate — a 204 has none — so this warns rather than blocks. It used to
   * be silent, and the field showed a JSON sample as its placeholder, so a mock serving nothing
   * looked like a mock serving that sample.
   */
  const bodyIsEmpty = (values.body ?? '').trim() === '';

  // A failed submit has to reach someone who is not looking at the bottom of a long form.
  React.useEffect(() => {
    if (submitCount > 0 && !isValid) errorAlert.current?.focus();
  }, [submitCount, isValid]);

  return (
    <section className="space--xxs bg--secondary">
      <div className="container">
        <div className="row justify-content-center no-gutters">
          <div className="col-md-12 col-lg-11">
            <div className="boxed boxed--border">
              <Form className="text-left mx-0">
                <CleanConfirmationOnSubmit />

                <div className="row">
                  <div className="col-md-12">
                    <Label htmlFor="name" required>Mock name</Label>
                    <RequiredTag />
                    <FastField
                      id="name"
                      type="string"
                      name="name"
                      aria-invalid={!!errors.name && !!touched.name}
                      aria-describedby="name-help"
                      className={`form-control ${!!errors.name && !!touched.name ? 'input--error' : ''}`}
                    />
                    <ErrorFeedback name="name" />
                    <Help id="name-help">A name to find this mock in your list later.</Help>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-md-6">
                    <Label htmlFor="status" required>HTTP Status</Label>
                    <RequiredTag />
                    <FastField type="text" name="status" component={SelectHttpStatusCode} />
                    <ErrorFeedback name="status" />
                    <Help id="status-help">The HTTP Code of the HTTP response you'll receive.</Help>
                  </div>
                </div>

                <div className="row mt-3">
                  <div className="col-md-6">
                    <Label htmlFor="contentType" required>Response Content Type</Label>
                    <RequiredTag />

                    <FastField type="text" name="contentType" component={SelectContentType} />
                    <ErrorFeedback name="contentType" />
                    <Help id="contentType-help">The Content-Type header that will be sent with the response.</Help>
                  </div>
                  <div className="col-md-6">
                    <Label htmlFor="charset" required>Charset</Label>
                    <RequiredTag />

                    <FastField type="text" name="charset" component={SelectCharset} />
                    <ErrorFeedback name="charset" />
                    <Help id="charset-help">The Charset used to encode/decode your payload.</Help>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12">
                    <Label htmlFor="headers">HTTP Headers</Label>
                    <OptionalTag />

                    <FastField type="text" name="headers" component={TextareaHeaders} />
                    <ErrorFeedback name="headers" />
                    <Help id="headers-help">Customize the HTTP headers sent in the response. Define the headers as a JSON object.</Help>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-12">
                    <Label htmlFor="body">HTTP Response Body</Label>
                    <OptionalTag />

                    <FastField type="text" name="body" component={TextareaCodeEditor} />
                    <ErrorFeedback name="body" />
                  </div>
                </div>
                <hr className="mt-4"></hr>
                <h5 className="mb-2">
                  Managing your mock after its creation
                  <OptionalTag />
                </h5>
                <div className="row">
                  <div className="col-md-6 mb-5">
                    <Label htmlFor="secret">Secret token</Label>

                    <FastField
                      id="secret"
                      type="text"
                      name="secret"
                      aria-invalid={!!errors.secret && !!touched.secret}
                      aria-describedby="secret-help"
                      className={`form-control ${!!errors.secret && !!touched.secret ? 'input--error' : ''}`}
                    />
                    <ErrorFeedback name="secret" />
                    <Help id="secret-help">
                      Required to update/delete your mock.
                      <br />
                      If blank, a random secret will be generated.
                    </Help>
                  </div>

                </div>
                {submitCount > 0 && !isValid && (
                  <div className="alert bg--error" role="alert" ref={errorAlert} tabIndex={-1}>
                    <div className="alert__body">
                      <span>Please fix the errors before saving your mock!</span>
                    </div>
                  </div>
                )}

                {bodyIsEmpty && (
                  <div className="alert bg--warning" role="status">
                    <div className="alert__body">
                      <span>
                        The response body is empty. Your mock will return an empty response unless you type or paste
                        a body.
                      </span>
                    </div>
                  </div>
                )}
                <div className="row">
                  <div className="col-md-8 ">
                    <button type="submit" className="btn btn--primary type--uppercase" disabled={isSubmitting}>
                      Generate my HTTP Response
                    </button>
                  </div>
                  <div className="col-md-4 ">
                    <div className="expiration-select input-select">
                      <SelectExpirationTime name="expiration" />
                    </div>
                  </div>
                </div>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/*
 * "Required" is said in the label rather than only in a floated badge: the badge is decoration,
 * and a field's obligation has to survive being read out of order by a screen reader.
 */
const RequiredTag = () => (
  <>
    &nbsp;<span className="badge badge-info float-right field-tag" aria-hidden="true">REQUIRED</span>
  </>
);

const OptionalTag = () => (
  <>
    &nbsp;<span className="badge badge-dark type--fade float-right field-tag" aria-hidden="true">OPTIONAL</span>
  </>
);

/**
 * A real `<label htmlFor>`, so clicking the name focuses the field and a screen reader announces
 * it. These used to be `<span>`s, which left every control on the page unnamed.
 */
const Label = (props: React.PropsWithChildren<{ htmlFor: string; required?: boolean }>) => (
  <label className="color--dark field-label" htmlFor={props.htmlFor}>
    {props.children}
    {props.required && <span className="sr-only"> (required)</span>}
  </label>
);

const ErrorFeedback = (props: { name: string }) => (
  <ErrorMessage name={props.name}>
    {(message) => (
      <span className="form-text color--error" role="alert" id={`${props.name}-error`}>
        {message}
      </span>
    )}
  </ErrorMessage>
);

const Help = (props: React.PropsWithChildren<{ id?: string }>) => (
  <small className="form-text color--primary" id={props.id}>
    {props.children}
  </small>
);

export default NewMockFormView;
