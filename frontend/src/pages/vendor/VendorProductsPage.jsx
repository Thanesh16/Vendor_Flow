import React, { useState, useEffect, useCallback } from 'react';
import productService from '../../services/productService';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import ProductModal from './ProductModal';
import { getImageUrl } from '../../utils/imageUrl';

export const VendorProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProducts = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentCategory = categoryFilter, currentAvail = availabilityFilter, currentSort = sortBy) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
        };
        if (currentSearch.trim()) params.search = currentSearch.trim();
        if (currentCategory !== 'ALL') params.category = currentCategory;
        if (currentAvail !== 'ALL') params.isAvailable = currentAvail === 'AVAILABLE';
        if (currentSort !== 'newest') params.sortBy = currentSort;

        const response = await productService.getAll(params);
        setProducts(response.data?.products || response.data?.items || []);
        if (response.data?.pagination) {
          setPagination(response.data.pagination);
        }
      } catch (err) {
        setError(err.message || 'Failed to load your products from database');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, searchQuery, categoryFilter, availabilityFilter, sortBy]
  );

  useEffect(() => {
    fetchProducts(page, limit, searchQuery, categoryFilter, availabilityFilter, sortBy);
  }, [page, limit, categoryFilter, availabilityFilter, sortBy]);

  // Debounced search and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts(1, limit, searchQuery, categoryFilter, availabilityFilter, sortBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryChange = (val) => {
    setCategoryFilter(val);
    setPage(1);
  };

  const handleAvailabilityChange = (val) => {
    setAvailabilityFilter(val);
    setPage(1);
  };

  const handleSortChange = (val) => {
    setSortBy(val);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setAvailabilityFilter('ALL');
    setSortBy('newest');
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    setModalOpen(true);
  };

  const handleProductSaved = (savedProduct, isEdit) => {
    if (isEdit) {
      setProducts((prev) =>
        prev.map((p) => (p._id === savedProduct._id ? savedProduct : p))
      );
    } else {
      setProducts((prev) => [savedProduct, ...prev]);
    }
  };

  const handleToggleAvailability = async (prod) => {
    setActionLoading(true);
    try {
      const response = await productService.toggleAvailability(prod._id, !prod.isAvailable);
      if (response.data?.product) {
        setProducts((prev) =>
          prev.map((p) => (p._id === prod._id ? response.data.product : p))
        );
      }
    } catch (err) {
      alert(err.message || 'Failed to toggle availability');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (prod) => {
    if (!window.confirm(`Are you sure you want to remove "${prod.productName}" from your catalog?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await productService.deleteProduct(prod._id);
      setProducts((prev) => prev.filter((p) => p._id !== prod._id));
    } catch (err) {
      alert(err.message || 'Failed to delete product');
    } finally {
      setActionLoading(false);
    }
  };

  // Distinct categories from loaded products
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  // Computed metrics
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.isAvailable).length;
  const lowStockCount = products.filter((p) => (p.availableQuantity || 0) <= 5).length;

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            My Product Catalog
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Publish, update inventory, and manage pricing for goods and equipment available to corporate buyers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenAdd}>
            + Add New Product
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Products
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-primary)', marginTop: 'var(--spacing-1)' }}>
              {totalCount}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Active in Catalog
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: 'var(--color-success)', marginTop: 'var(--spacing-1)' }}>
              {activeCount}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ padding: 'var(--spacing-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Low Stock Alert (≤ 5)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: lowStockCount > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)', marginTop: 'var(--spacing-1)' }}>
              {lowStockCount}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Availability Filter */}
              <select
                value={availabilityFilter}
                onChange={(e) => handleAvailabilityChange(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Active Only</option>
                <option value="UNAVAILABLE">Inactive / Paused</option>
              </select>

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="newest">Sort: Recently Listed</option>
                <option value="oldest">Sort: Oldest Listed</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="stock_desc">Highest Stock Quantity</option>
                <option value="name_asc">Product Name (A-Z)</option>
              </select>
            </div>

            {/* Search Input & Reset Button */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <input
                  type="text"
                  placeholder="Search products, specs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.375rem 2rem 0.375rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-size-xs)',
                    outline: 'none',
                    backgroundColor: 'var(--color-bg)',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {(searchQuery || categoryFilter !== 'ALL' || availabilityFilter !== 'ALL' || sortBy !== 'newest') && (
                <Button variant="outline" size="sm" onClick={clearFilters} style={{ fontSize: 'var(--font-size-xs)' }}>
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Products Table */}
      <Card>
        {error && (
          <div
            style={{
              padding: 'var(--spacing-4)',
              backgroundColor: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-2)', width: '56px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>Image</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Product & Description</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Unit Price</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>In Stock</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Delivery SLA</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Availability</th>
                <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--spacing-10)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Loading product catalog from MongoDB...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--spacing-12)', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 'var(--spacing-1)' }}>
                      No Products Found
                    </div>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-4)' }}>
                      {searchQuery || categoryFilter !== 'ALL' || availabilityFilter !== 'ALL'
                        ? 'No products match your current filters. Clear filters or try a different search.'
                        : 'No products added yet. Add your first product to make it available to procurement.'}
                    </p>
                    <Button variant="primary" size="sm" onClick={handleOpenAdd}>
                      + Add Your First Product
                    </Button>
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr
                    key={prod._id}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: 'var(--spacing-3) var(--spacing-2)', textAlign: 'center', width: '56px' }}>
                      <div
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          backgroundColor: '#ffffff',
                          border: '1px solid var(--color-border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                        }}
                      >
                        {prod.imageUrl || prod.images?.[0]?.url ? (
                          <img
                            src={getImageUrl(prod.imageUrl || prod.images[0].url)}
                            alt={prod.productName}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<span style="font-size: 18px;">📦</span>';
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '18px' }}>📦</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', maxWidth: '320px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                          {prod.productName}
                        </span>
                        {prod.masterCatalogId && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(30, 58, 138, 0.1)',
                              color: 'var(--color-primary)',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              letterSpacing: '0.02em',
                            }}
                            title={`Linked to Master Catalog: ${prod.masterCatalogId}`}
                          >
                            CATALOG
                          </span>
                        )}
                      </div>
                      {prod.description && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '2px',
                          }}
                          title={prod.description}
                        >
                          {prod.description}
                        </div>
                      )}
                      {prod.specifications && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-text-light)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginTop: '2px',
                          }}
                          title={prod.specifications}
                        >
                          ⚙ {prod.specifications}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          backgroundColor: 'rgba(30, 58, 138, 0.08)',
                          color: 'var(--color-primary)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 600,
                        }}
                      >
                        {prod.category}
                      </span>
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-text-main)' }}>
                      <div>₹{Number(prod.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      {prod.referencePrice > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: '1px' }}>
                          Ref: ₹{Number(prod.referencePrice).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: prod.availableQuantity <= 5 ? 'var(--color-error)' : 'var(--color-text-main)',
                        }}
                      >
                        {prod.availableQuantity} {prod.unit || 'Units'}
                      </span>
                      {prod.availableQuantity <= 5 && (
                        <div style={{ fontSize: '10px', color: 'var(--color-error)', fontWeight: 600, marginTop: '2px' }}>
                          Low Stock
                        </div>
                      )}
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      {prod.deliveryDays} {prod.deliveryDays === 1 ? 'day' : 'days'}
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(prod)}
                        disabled={actionLoading}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        title="Click to toggle availability"
                      >
                        <Badge variant={prod.isAvailable ? 'success' : 'neutral'}>
                          {prod.isAvailable ? 'Active' : 'Hidden'}
                        </Badge>
                      </button>
                    </td>

                    <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 'var(--spacing-2)' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(prod)}
                          disabled={actionLoading}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(prod)}
                          disabled={actionLoading}
                          style={{ color: 'var(--color-error)', borderColor: 'var(--color-error-border)' }}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>

        {/* Server-Side Pagination Bar */}
        {!loading && pagination.total > 0 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            itemLabel="products"
          />
        )}
      </Card>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <ProductModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          product={editingProduct}
          onProductSaved={handleProductSaved}
        />
      )}
    </div>
  );
};

export default VendorProductsPage;
