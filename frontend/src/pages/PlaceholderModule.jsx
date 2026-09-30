import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import Card, { CardBody } from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';

const moduleConfig = {
  '/users': {
    title: 'User Management',
    icon: '👥',
    phase: 'Phase 13',
    description: 'Administrative user provisioning, access control lists, and security permission assignment.',
  },
  '/vendors': {
    title: 'Vendor Directory & Onboarding',
    icon: '🏢',
    phase: 'Phase 5',
    description: 'Supplier profile approvals, document verification, and compliance status management.',
  },
  '/purchase-requests': {
    title: 'Purchase Requests',
    icon: '📝',
    phase: 'Phase 6',
    description: 'Departmental requisition workflows, itemized specifications, and procurement authorizations.',
  },
  '/purchase-orders': {
    title: 'Purchase Orders',
    icon: '📦',
    phase: 'Phase 7',
    description: '11-stage purchase order lifecycle, dispatching, shipment tracking, and fulfillment confirmation.',
  },
  '/evaluations': {
    title: 'Vendor Performance & Scoring',
    icon: '⭐',
    phase: 'Phase 8',
    description: 'Metric evaluations covering delivery timeliness, product quality, pricing fidelity, and vendor audits.',
  },
  '/profile': {
    title: 'My Supplier Profile',
    icon: '🏢',
    phase: 'Phase 5',
    description: 'Self-service business entity profile, contact details, tax identification, and banking details.',
  },
  '/my-orders': {
    title: 'My Purchase Orders',
    icon: '📦',
    phase: 'Phase 7',
    description: 'Vendor acknowledgment portal for incoming purchase orders, shipment tracking, and fulfillment updates.',
  },
  '/my-performance': {
    title: 'My Performance Scorecard',
    icon: '⭐',
    phase: 'Phase 8',
    description: 'Supplier performance benchmarks, audit reports, and quality compliance metrics.',
  },
};

export const PlaceholderModule = () => {
  const location = useLocation();
  const info = moduleConfig[location.pathname] || {
    title: 'Upcoming Business Module',
    icon: '🚀',
    phase: 'Future Phase',
    description: 'This feature will be implemented in an upcoming phase of VENDORFLOW.',
  };

  return (
    <div style={{ maxWidth: '640px', margin: 'var(--spacing-8) auto' }}>
      <Card>
        <CardBody style={{ padding: 'var(--spacing-10)', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-3)' }}>
            {info.icon}
          </div>
          <Badge variant="info" style={{ marginBottom: 'var(--spacing-3)' }}>
            {info.phase}
          </Badge>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-2)' }}>
            {info.title}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, marginBottom: 'var(--spacing-6)' }}>
            {info.description}
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', marginBottom: 'var(--spacing-6)' }}>
            In accordance with the phase-by-phase development protocol, this business module will be implemented in its designated phase.
          </p>
          <Link to="/dashboard">
            <Button variant="primary">Return to Dashboard</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
};

export default PlaceholderModule;
