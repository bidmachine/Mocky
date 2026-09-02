import React from 'react';

import { MockStored } from '../../../redux/mocks/types';
import MockRow from './MockRow';

const ManagerTable = (props: { mocks: MockStored[] }) => (
  <section className="text-center space--xxs">
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-12">
          <table className="table border--round table--alternate-row table-sm table--mocks">
            <thead className="thead-dark">
              <tr>
                <th style={{ width: '4%' }} aria-label="Details" />
                <th style={{ width: '38%' }}>Name</th>
                <th style={{ width: '43%' }}>Response</th>
                <th style={{ width: '15%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {props.mocks.map((mock) => (
                <MockRow key={mock.id} mock={mock} />
              ))}
            </tbody>
          </table>

          <div className="alert bg--primary">
            <div className="alert__body">
              <strong>Warning</strong>: This data is stored on your computer. It will be lost if you clean your
              browser cache (local-storage).
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default ManagerTable;
