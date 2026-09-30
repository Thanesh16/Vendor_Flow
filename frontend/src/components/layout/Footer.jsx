import React from 'react';

export const Footer = () => {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <p style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
            Vendor Management System (VMS)
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)' }}>
            Enterprise Procurement & Supplier Lifecycle Platform &bull; Phase 1: Foundation Architecture
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)' }}>
          <p>MongoDB Integration scheduled for Phase 2</p>
          <p style={{ color: 'var(--color-text-light)' }}>Built with React, Vite, Node.js & Express</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
