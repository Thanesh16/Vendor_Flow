import React, { useState, useEffect, useCallback } from 'react';
import Card, { CardBody, CardHeader } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import masterProductService from '../../services/masterProductService';
import { getImageUrl } from '../../utils/imageUrl';

const CATEGORY_COLORS = {
  'IT Hardware': 'primary',
  'Electronics': 'info',
  'Office Equipment': 'warning',
  'Furniture': 'neutral',
  'Industrial Equipment': 'error',
  'Stationery': 'neutral',
  'Safety Equipment': 'error',
  'Software': 'primary',
};

export const AdminMasterCatalogPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });

  // Metadata
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  // Detail Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Live price refresh state (per-row)
  const [refreshingPriceId, setRefreshingPriceId] = useState(null);

  // Edit / Create Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    catalogId: '',
    productName: '',
    brand: '',
    model: '',
    category: 'IT Hardware',
    unit: 'Units',
    referencePrice: '',
    description: '',
    specifications: '',
    imageUrl: '',
    tags: '',
  });

  // Fetch categories and brands metadata
  useEffect(() => {
    let mounted = true;
    masterProductService
      .getCategoriesAndBrands()
      .then((res) => {
        if (mounted && res?.data) {
          setCategories(res.data.categories || []);
          setBrands(res.data.brands || []);
        }
      })
      .catch((err) => console.warn('Could not load catalog metadata:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Refresh live market price for a single catalog item
  const handleRefreshPrice = async (item) => {
    setRefreshingPriceId(item._id);
    try {
      const res = await masterProductService.refreshPrice(item._id);
      if (res?.data?.marketPrice || res?.data?.price) {
        const freshPrice = res.data.marketPrice || res.data.price;
        setProducts((prev) =>
          prev.map((p) =>
            p._id === item._id
              ? { ...p, marketPrice: freshPrice, referencePrice: freshPrice, marketPriceStatus: res.data.status }
              : p
          )
        );
        setSuccessMessage(`Live market price refreshed: ₹${freshPrice.toLocaleString('en-IN')} (${res.data.status})`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch {
      setError('Failed to refresh live price. Check API key configuration.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setRefreshingPriceId(null);
    }
  };

  // Fetch Master Products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        limit,
        activeOnly: 'false',
      };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (categoryFilter !== 'ALL') {
        params.category = categoryFilter;
      }
      if (brandFilter !== 'ALL') {
        params.brand = brandFilter;
      }

      const res = await masterProductService.getAll(params);
      setProducts(res?.data || []);
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load master products');
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, categoryFilter, brandFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setFormData({
      catalogId: '',
      productName: '',
      brand: '',
      model: '',
      category: categories[0] || 'IT Hardware',
      unit: 'Units',
      referencePrice: '',
      description: '',
      specifications: '',
      imageUrl: '',
      tags: '',
    });
    setFormError('');
    setEditModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setIsEditing(true);
    setFormData({
      _id: item._id,
      catalogId: item.catalogId,
      productName: item.productName || '',
      brand: item.brand || '',
      model: item.model || '',
      category: item.category || 'IT Hardware',
      unit: item.unit || 'Units',
      referencePrice: item.referencePrice !== undefined ? item.referencePrice : '',
      description: item.description || '',
      specifications: item.specifications || '',
      imageUrl: item.imageUrl || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags || '',
    });
    setFormError('');
    setEditModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.productName.trim()) {
      setFormError('Product Name is required.');
      return;
    }
    if (!formData.brand.trim()) {
      setFormError('Brand is required.');
      return;
    }
    if (formData.referencePrice === '' || isNaN(Number(formData.referencePrice)) || Number(formData.referencePrice) < 0) {
      setFormError('Please enter a valid non-negative Reference Price in INR.');
      return;
    }
    if (!isEditing && !formData.catalogId.trim()) {
      setFormError('Catalog ID is required.');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        productName: formData.productName.trim(),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        category: formData.category.trim(),
        unit: formData.unit.trim() || 'Units',
        referencePrice: Number(formData.referencePrice),
        description: formData.description.trim(),
        specifications: formData.specifications.trim(),
        imageUrl: formData.imageUrl.trim(),
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      };

      if (!isEditing) {
        payload.catalogId = formData.catalogId.trim().toUpperCase();
        await masterProductService.create(payload);
        setSuccessMessage(`Master product "${payload.productName}" created successfully.`);
      } else {
        await masterProductService.update(formData._id, payload);
        setSuccessMessage(`Master product "${payload.productName}" updated successfully.`);
      }

      setEditModalOpen(false);
      fetchProducts();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 'var(--spacing-6)', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <span>📚</span> Master Product Catalog
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Authoritative corporate catalog baseline with standardized specifications, verified images, and INR reference market pricing.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenCreateModal}>
          + Add Catalog Entry
        </Button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Total Catalog Products
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
              {pagination.total || products.length}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Active Categories
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-accent)', marginTop: '4px' }}>
              {categories.length || 8}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Standard Currency
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
              INR (₹)
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              Procurement Baseline
            </div>
            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '6px' }}>
              Auto-fill & Price Ref
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Success / Error Banners */}
      {successMessage && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-4)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
          }}
        >
          ✓ {successMessage}
        </div>
      )}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            color: 'var(--color-error)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-4)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ gridColumn: 'span 2' }}>
              <input
                type="text"
                placeholder="Search catalog by name, brand, model, or ID (e.g., iPhone 15, Dell, ELEC-)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-main)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-main)',
                }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-sm)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-main)',
                }}
              >
                <option value="ALL">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Catalog Table */}
      <Card>
        <CardHeader
          title={`Catalog Items (${pagination.total || products.length})`}
          subtitle="Showing official reference items with standard technical specifications and pricing"
        />
        <CardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading Master Catalog...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: 'var(--spacing-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No master catalog products match your search/filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Item
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Catalog ID
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Brand / Model
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Category
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Price (INR)
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      Variants
                    </th>
                    <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((item) => (
                    <tr
                      key={item._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(30, 58, 138, 0.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Product Preview */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                          {item.imageUrl ? (
                            <img
                              src={getImageUrl(item.imageUrl)}
                              alt={item.productName}
                              style={{
                                width: '42px',
                                height: '42px',
                                objectFit: 'contain',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-border)',
                                backgroundColor: '#ffffff',
                                padding: '2px',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                backgroundColor: 'var(--color-bg)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0,
                              }}
                            >
                              📦
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{item.productName}</div>
                            {item.unit && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                Unit: {item.unit}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Catalog ID */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(30, 58, 138, 0.08)', color: 'var(--color-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.catalogId}
                        </span>
                      </td>

                      {/* Brand & Model */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{item.brand}</div>
                        {item.model && <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{item.model}</div>}
                      </td>

                      {/* Category */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <Badge variant={CATEGORY_COLORS[item.category] || 'neutral'} size="sm">
                          {item.category}
                        </Badge>
                      </td>

                      {/* Reference Price / Market Price */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        {item.marketPrice > 0 && item.marketPrice !== item.referencePrice ? (
                          <>
                            <div style={{ fontWeight: 700, color: '#7c3aed', fontSize: 'var(--font-size-sm)' }}>
                              ₹{item.marketPrice?.toLocaleString('en-IN')}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              Ref: ₹{item.referencePrice?.toLocaleString('en-IN')}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700, color: '#059669', fontSize: 'var(--font-size-sm)' }}>
                              ₹{item.referencePrice?.toLocaleString('en-IN')}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                              {item.marketPriceStatus || 'Reference'}
                            </span>
                          </>
                        )}
                      </td>

                      {/* Variants */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        {Array.isArray(item.variants) && item.variants.length > 0 ? (
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-primary)' }}>
                            {item.variants.length} variant{item.variants.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                            Standard
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRefreshPrice(item)}
                            disabled={refreshingPriceId === item._id}
                            title="Fetch latest live market price from external API"
                            style={{
                              padding: '4px 9px', fontSize: '11px', fontWeight: 700,
                              backgroundColor: refreshingPriceId === item._id ? '#f3f4f6' : '#ede9fe',
                              border: '1px solid #c4b5fd', borderRadius: 'var(--radius-sm)',
                              cursor: refreshingPriceId === item._id ? 'not-allowed' : 'pointer',
                              color: '#7c3aed', whiteSpace: 'nowrap',
                            }}
                          >
                            {refreshingPriceId === item._id ? '⏳' : '🔄'}
                          </button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedProduct(item)}>
                            View
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(item)}>
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ padding: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Details View Modal */}
      {selectedProduct && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'rgba(30, 58, 138, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                  {selectedProduct.catalogId}
                </span>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)', marginTop: '4px' }}>
                  {selectedProduct.productName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'var(--spacing-6)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', alignItems: 'center' }}>
                {selectedProduct.imageUrl ? (
                  <img
                    src={getImageUrl(selectedProduct.imageUrl)}
                    alt={selectedProduct.productName}
                    style={{ width: '80px', height: '80px', objectFit: 'contain', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', padding: '4px' }}
                  />
                ) : (
                  <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                    📦
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    Brand: <strong style={{ color: 'var(--color-text-main)' }}>{selectedProduct.brand}</strong> | Model: <strong style={{ color: 'var(--color-text-main)' }}>{selectedProduct.model || 'Standard'}</strong>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    Category: <strong style={{ color: 'var(--color-text-main)' }}>{selectedProduct.category}</strong>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
                    ₹{selectedProduct.referencePrice?.toLocaleString('en-IN')}{' '}
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      per {selectedProduct.unit || 'Unit'} (Catalog Ref Price)
                    </span>
                  </div>
                </div>
              </div>

              {selectedProduct.description && (
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Overview
                  </div>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {selectedProduct.specifications && (
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Technical Specifications
                  </div>
                  <div style={{ backgroundColor: 'var(--color-bg)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 1.5, border: '1px solid var(--color-border)' }}>
                    {selectedProduct.specifications}
                  </div>
                </div>
              )}

              {Array.isArray(selectedProduct.variants) && selectedProduct.variants.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Configurable Variants ({selectedProduct.variants.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedProduct.variants.map((v, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 12px',
                          backgroundColor: 'var(--color-bg)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontSize: 'var(--font-size-xs)',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{v.name || `${v.color || ''} ${v.storage || ''}`.trim()}</span>
                        <span style={{ color: '#059669', fontWeight: 700 }}>
                          ₹{(v.referencePrice || selectedProduct.referencePrice)?.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const item = selectedProduct;
                  setSelectedProduct(null);
                  handleOpenEditModal(item);
                }}
              >
                Edit Details
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {editModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {isEditing ? `Edit Master Product: ${formData.catalogId}` : 'Add New Master Product to Catalog'}
              </h2>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={formSubmitting}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ padding: 'var(--spacing-6)' }}>
              {formError && (
                <div
                  style={{
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid var(--color-error-border)',
                    color: 'var(--color-error)',
                    padding: 'var(--spacing-3) var(--spacing-4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    marginBottom: 'var(--spacing-4)',
                  }}
                >
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-4)' }}>
                {!isEditing && (
                  <div>
                    <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                      Catalog ID *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ITHW-DELL-5440"
                      value={formData.catalogId}
                      onChange={(e) => setFormData({ ...formData, catalogId: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.875rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: 'var(--font-size-sm)',
                        fontFamily: 'monospace',
                        backgroundColor: 'var(--color-bg)',
                      }}
                    />
                  </div>
                )}

                <div style={{ gridColumn: isEditing ? 'span 2' : 'span 1' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dell Latitude 5440 Business Laptop"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Brand *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dell"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Latitude 5440"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  >
                    {[
                      'IT Hardware',
                      'Electronics',
                      'Office Equipment',
                      'Furniture',
                      'Industrial Equipment',
                      'Stationery',
                      'Safety Equipment',
                      'Software',
                    ].map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Reference Price (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 78000"
                    value={formData.referencePrice}
                    onChange={(e) => setFormData({ ...formData, referencePrice: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Units, Pieces, Licenses"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Official Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Overview & Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Concise description of this catalog item..."
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Technical Specifications
                  </label>
                  <textarea
                    rows={3}
                    value={formData.specifications}
                    onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                    placeholder="Processor: Intel Core i7 | RAM: 16GB DDR5 | Storage: 512GB NVMe SSD..."
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 'var(--spacing-1)' }}>
                    Search Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="laptop, dell, latitude, business, intel"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: 'var(--font-size-sm)',
                      backgroundColor: 'var(--color-bg)',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 'var(--spacing-6)', display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)' }}>
                <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)} disabled={formSubmitting}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Master Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMasterCatalogPage;
