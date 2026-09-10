import React from 'react';
import { NavLink } from 'react-router-dom';

/**
 * Footer for an internal deployment.
 *
 * The upstream project funds itself through the footer — donation links, the author's social
 * accounts, a sponsor slot. None of that belongs on a tool a handful of people run inside the
 * company, so what remains is the FAQ and the cookie policy the consent banner links to.
 */
export default () => (
  <footer className="text-center-xs space--xs">
    <div className="container">
      <div className="row">
        <div className="col-sm-12">
          <span className="type--fine-print">Mocky</span>
          <NavLink to="/faq" className="type--fine-print">
            FAQ
          </NavLink>
          <NavLink to="/policies/cookies" className="type--fine-print">
            Cookie Policy
          </NavLink>
        </div>
      </div>
    </div>
  </footer>
);
