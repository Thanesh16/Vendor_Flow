import React from 'react';
import { Link } from 'react-router-dom';
import Card, { CardBody } from '../components/common/Card';
import Button from '../components/common/Button';

export const NotFoundPage = () => {
  return (
    <div className="container" style={{ padding: 'var(--spacing-16) 0', textAlign: 'center' }}>
      <Card style={{ maxWidth: '500px', margin: '0 auto' }}>
        <CardBody style={{ padding: 'var(--spacing-10)' }}>
          <h1 style={{ fontSize: '4rem', color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}>
            404
          </h1>
          <h2 style={{ marginBottom: 'var(--spacing-4)' }}>Page Not Found</h2>
          <p style={{ marginBottom: 'var(--spacing-6)' }}>
            The requested page does not exist or has not yet been implemented in this phase.
          </p>
          <Link to="/">
            <Button variant="primary">Return to Home</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default NotFoundPage;
