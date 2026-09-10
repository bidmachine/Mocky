import './styles.css';

import React, { useState } from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import { useSelector } from 'react-redux';
import { Redirect } from 'react-router-dom';

import { faCopy as iconCopy } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { selectLatestMock } from '../../redux/mocks/slice';
import DesignerTitle from './components/DesignerTitle';
import NewMockFeatures from './components/NewMockFeatures';
import { absoluteMockLink } from '../../services/url';

const NewMockConfirmation = () => {
  const [copied, setCopied] = useState(0);
  const mock = useSelector(selectLatestMock);

  if (!mock) {
    return <Redirect to="/design" />;
  }

  return (
    <>
      <DesignerTitle />

      <section className="space--xxs bg--primary">
        <div className="container">
          <div className="row justify-content-center no-gutters">
            <div className="col-md-10 col-lg-8 text-center">
              <h3>{copied > 0 ? "Link copied, You're now ready!" : 'Your mock is ready!'}</h3>

              <div>
                <h4 className="mb-2">
                  Mock URL
                  <CopyToClipboard text={absoluteMockLink(mock.link)} onCopy={() => setCopied(1)}>
                    <button type="button" className="copy-button" aria-label="Copy the mock URL">
                      <FontAwesomeIcon icon={iconCopy} className="iconMocky--main" />
                    </button>
                  </CopyToClipboard>
                </h4>

                <pre className="user-select-all">
                  <a href={absoluteMockLink(mock.link)} target="_blank" rel="noopener noreferrer">
                    {absoluteMockLink(mock.link)}
                  </a>
                </pre>
              </div>

              <div className="secret-link">
                <span data-tooltip="This link allow you to delete your mock whenever you want">
                  Secret delete link
                  <CopyToClipboard text={mock.deleteLink} onCopy={() => setCopied(2)}>
                    <button type="button" className="copy-button" aria-label="Copy the secret delete link">
                      <FontAwesomeIcon icon={iconCopy} className="iconMocky--sec" />
                    </button>
                  </CopyToClipboard>
                </span>

                <pre className="unpad unmarg--bottom user-select-all">
                  <small>{mock.deleteLink}</small>
                </pre>

                <p className="secret-warning" role="note">
                  Save this link now. It is the only way to edit or delete this mock, it is not shown again, and it
                  cannot be recovered &mdash; it is kept in this browser's list, which a cleared cache will lose.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <NewMockFeatures />
    </>
  );
};

export default NewMockConfirmation;
