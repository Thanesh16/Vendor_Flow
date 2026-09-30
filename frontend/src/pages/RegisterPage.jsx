import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card, { CardBody } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

export const RegisterPage = () => {
  // Role Selection ('VENDOR' or 'EMPLOYEE')
  const [role, setRole] = useState('VENDOR');

  // Credentials
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Company Details (For Vendors)
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('United States');
  const [businessDescription, setBusinessDescription] = useState('');

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password) {
      setError('Please fill in your name, email, and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (role === 'EMPLOYEE') {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: 'EMPLOYEE',
        });
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: 'VENDOR',
          companyName: companyName.trim() || `${name.trim()} Supplies`,
          phone: phone.trim() || '+1-555-0100',
          taxId: taxId.trim() || `TAX-${Date.now().toString().slice(-6)}`,
          address: address.trim() || '100 Business Parkway',
          city: city.trim() || 'Austin',
          state: state.trim() || 'Texas',
          country: country.trim() || 'United States',
          businessDescription: businessDescription.trim(),
        });
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-10) 0', flex: 1, display: 'flex', alignItems: 'center' }}>
      <div className="container" style={{ maxWidth: '640px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
          <Badge variant="info" style={{ marginBottom: 'var(--spacing-2)' }}>
            {role === 'EMPLOYEE' ? 'Corporate Requisitions' : 'Supplier Onboarding'}
          </Badge>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)' }}>
            {role === 'EMPLOYEE' ? 'Employee Registration' : 'Vendor Registration'}
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-1)' }}>
            {role === 'EMPLOYEE'
              ? 'Create your employee account to submit purchase requests and equipment orders.'
              : 'Create your supplier account and register your company in the VENDORFLOW procurement network.'}
          </p>
        </div>

        {/* Role Toggle */}
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-6)' }}>
          <button
            type="button"
            onClick={() => { setRole('VENDOR'); setError(''); }}
            style={{
              flex: 1,
              padding: 'var(--spacing-3)',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${role === 'VENDOR' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: role === 'VENDOR' ? 'rgba(30, 58, 138, 0.06)' : 'var(--color-surface)',
              color: role === 'VENDOR' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              transition: 'all 0.2s ease',
            }}
          >
            🏢 Supplier / Vendor
          </button>
          <button
            type="button"
            onClick={() => { setRole('EMPLOYEE'); setError(''); }}
            style={{
              flex: 1,
              padding: 'var(--spacing-3)',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${role === 'EMPLOYEE' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              backgroundColor: role === 'EMPLOYEE' ? 'rgba(30, 58, 138, 0.06)' : 'var(--color-surface)',
              color: role === 'EMPLOYEE' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
              fontSize: 'var(--font-size-sm)',
              transition: 'all 0.2s ease',
            }}
          >
            👤 Employee / Requester
          </button>
        </div>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-8)' }}>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  color: 'var(--color-error)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  marginBottom: 'var(--spacing-5)',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Account Credentials Section */}
              <div style={{ marginBottom: role === 'VENDOR' ? 'var(--spacing-6)' : 'var(--spacing-4)' }}>
                <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-2)' }}>
                  {role === 'VENDOR' ? '1. Account Credentials' : 'Account Credentials'}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label
                      htmlFor="reg-name"
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        marginBottom: 'var(--spacing-1)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      Contact Person / Representative Name *
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label
                      htmlFor="reg-email"
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        marginBottom: 'var(--spacing-1)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      Business Email Address *
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. contact@supplier.com"
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        marginBottom: 'var(--spacing-1)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      Password (min. 6 chars) *
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-confirm-password"
                      style={{
                        display: 'block',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        marginBottom: 'var(--spacing-1)',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      Confirm Password *
                    </label>
                    <input
                      id="reg-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        outline: 'none',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Company Information Section (Vendors Only) */}
              {role === 'VENDOR' && (
                <div style={{ marginBottom: 'var(--spacing-6)' }}>
                  <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', marginBottom: 'var(--spacing-3)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--spacing-2)' }}>
                    2. Supplier & Company Information
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label
                        htmlFor="reg-company"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Company / Legal Entity Name *
                      </label>
                      <input
                        id="reg-company"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Apex Industrial Solutions Inc."
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-phone"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Business Phone Number *
                      </label>
                      <input
                        id="reg-phone"
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +1-555-0155"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-taxid"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Tax ID / EIN / Registration No. *
                      </label>
                      <input
                        id="reg-taxid"
                        type="text"
                        value={taxId}
                        onChange={(e) => setTaxId(e.target.value)}
                        placeholder="e.g. US-TAX-123456789"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label
                        htmlFor="reg-address"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Corporate Address *
                      </label>
                      <input
                        id="reg-address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. 500 Industrial Parkway, Suite 200"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-city"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        City *
                      </label>
                      <input
                        id="reg-city"
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Dallas"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-state"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        State / Province *
                      </label>
                      <input
                        id="reg-state"
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Texas"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label
                        htmlFor="reg-country"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Country *
                      </label>
                      <input
                        id="reg-country"
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="e.g. United States"
                        required
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label
                        htmlFor="reg-desc"
                        style={{
                          display: 'block',
                          fontSize: 'var(--font-size-sm)',
                          fontWeight: 600,
                          marginBottom: 'var(--spacing-1)',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        Business Scope & Capabilities (Optional)
                      </label>
                      <textarea
                        id="reg-desc"
                        rows={3}
                        value={businessDescription}
                        onChange={(e) => setBusinessDescription(e.target.value)}
                        placeholder="Describe the goods, raw materials, or services your business supplies..."
                        style={{
                          width: '100%',
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-sm)',
                          outline: 'none',
                          backgroundColor: 'var(--color-bg)',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                style={{ width: '100%', padding: '0.75rem', fontSize: 'var(--font-size-base)' }}
              >
                {submitting
                  ? (role === 'EMPLOYEE' ? 'Creating Employee Account...' : 'Registering Supplier...')
                  : (role === 'EMPLOYEE' ? 'Register Employee Account' : 'Register Vendor & Submit Profile')}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Already registered? </span>
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
