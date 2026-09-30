import React, { useState, useEffect, useCallback } from 'react';
import productService from '../../services/productService';
import vendorService from '../../services/vendorService';
import Card, { CardBody } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import { getImageUrl } from '../../utils/imageUrl';

export const ProcurementProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    hasPrevPage: false,
    hasNextPage: false,
  });

  // Approved vendors & distinct categories
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [categories, setCategories] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [comparisonList, setComparisonList] = useState([]);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [isPhotoZoomed, setIsPhotoZoomed] = useState(false);

  // Load approved vendors and categories on mount
  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [vendorsRes, catRes] = await Promise.allSettled([
          vendorService.getAllVendors({ status: 'APPROVED', all: 'true' }),
          productService.getCategories(),
        ]);
        if (vendorsRes.status === 'fulfilled') {
          setApprovedVendors(vendorsRes.value?.data?.vendors || vendorsRes.value?.data?.items || []);
        }
        if (catRes.status === 'fulfilled') {
          setCategories(catRes.value?.data?.categories || []);
        }
      } catch {
        // Fallback gracefully
      }
    };
    loadFiltersData();
  }, []);

  const fetchCatalog = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = searchQuery, currentCategory = categoryFilter, currentVendor = vendorFilter, currentAvail = availabilityFilter, currentSort = sortBy) => {
      setLoading(true);
      setError('');
      try {
        const params = {
          page: currentPage,
          limit: currentLimit,
        };
        if (currentSearch.trim()) params.search = currentSearch.trim();
        if (currentCategory !== 'ALL') params.category = currentCategory;
        if (currentVendor !== 'ALL') params.vendorId = currentVendor;
        if (currentAvail === 'AVAILABLE') params.isAvailable = true;
        if (currentAvail === 'UNAVAILABLE') params.isAvailable = false;
        if (currentSort !== 'newest') params.sortBy = currentSort;

        const response = await productService.getAll(params);
        setProducts(response.data?.products || response.data?.items || []);
        if (response.data?.pagination) {
          setPagination(response.data.pagination);
        }
      } catch (err) {
        setError(err.message || 'Failed to load procurement product catalog');
      } finally {
        setLoading(false);
      }
    },
    [page, limit, searchQuery, categoryFilter, vendorFilter, availabilityFilter, sortBy]
  );

  useEffect(() => {
    fetchCatalog(page, limit, searchQuery, categoryFilter, vendorFilter, availabilityFilter, sortBy);
  }, [page, limit, categoryFilter, vendorFilter, availabilityFilter, sortBy]);

  // Debounced search and reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCatalog(1, limit, searchQuery, categoryFilter, vendorFilter, availabilityFilter, sortBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCategoryChange = (val) => {
    setCategoryFilter(val);
    setPage(1);
  };

  const handleVendorChange = (val) => {
    setVendorFilter(val);
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
    setVendorFilter('ALL');
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

  // Comparison drawer controls
  const toggleComparison = (product) => {
    if (comparisonList.some((p) => p._id === product._id)) {
      setComparisonList((prev) => prev.filter((p) => p._id !== product._id));
    } else {
      if (comparisonList.length >= 3) {
        alert('You can compare a maximum of 3 products at a time.');
        return;
      }
      setComparisonList((prev) => [...prev, product]);
    }
  };

  const clearComparison = () => {
    setComparisonList([]);
    setComparisonModalOpen(false);
  };

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
            Vendor Products Catalog
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Browse, compare, and verify commercial supplies and IT equipment from approved vendors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <Button variant="outline" size="sm" onClick={fetchCatalog} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Catalog'}
          </Button>

          {/* View Toggle */}
          <div style={{ display: 'inline-flex', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                backgroundColor: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: viewMode === 'grid' ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              ⊞ Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                border: 'none',
                backgroundColor: viewMode === 'table' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: viewMode === 'table' ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              ☰ Table
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card style={{ marginBottom: 'var(--spacing-6)' }}>
        <CardBody style={{ padding: 'var(--spacing-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
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

              {/* Vendor Dropdown */}
              <select
                value={vendorFilter}
                onChange={(e) => handleVendorChange(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Approved Vendors</option>
                {approvedVendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.companyName}
                  </option>
                ))}
              </select>

              {/* Availability Filter */}
              <select
                value={availabilityFilter}
                onChange={(e) => handleAvailabilityChange(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                  outline: 'none',
                  backgroundColor: 'var(--color-bg)',
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">All Availability</option>
                <option value="AVAILABLE">Available Only</option>
                <option value="UNAVAILABLE">Out of Stock</option>
              </select>

              {/* Sort By Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
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
                <option value="delivery_asc">Fastest Delivery SLA</option>
                <option value="stock_desc">Highest Stock Quantity</option>
                <option value="name_asc">Product Name (A-Z)</option>
              </select>
            </div>

            {/* Search Input and Reset */}
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flex: '1', minWidth: '220px', maxWidth: '420px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search products, brands, specs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 2rem 0.45rem 0.75rem',
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

              {(searchQuery || categoryFilter !== 'ALL' || vendorFilter !== 'ALL' || availabilityFilter !== 'ALL' || sortBy !== 'newest') && (
                <Button variant="outline" size="sm" onClick={clearFilters} style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main Content Area */}
      {error && (
        <div
          style={{
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--spacing-6)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-16) 0', color: 'var(--color-text-muted)' }}>
          Loading products from approved suppliers...
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardBody style={{ textAlign: 'center', padding: 'var(--spacing-16)' }}>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text-main)', marginBottom: 'var(--spacing-2)' }}>
              No Approved Vendor Products Found
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
              {searchQuery || categoryFilter !== 'ALL' || vendorFilter !== 'ALL'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'Approved vendors have not published any products yet. Ensure vendors are approved and have added products to their catalog.'}
            </p>
          </CardBody>
        </Card>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 'var(--spacing-5)' }}>
          {products.map((prod) => {
            const isCompared = comparisonList.some((p) => p._id === prod._id);
            return (
              <Card
                key={prod._id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: isCompared ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <CardBody style={{ padding: 'var(--spacing-5)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {/* Product Image Header */}
                  <div
                    style={{
                      height: '170px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      marginBottom: 'var(--spacing-3)',
                      position: 'relative',
                      padding: 'var(--spacing-2)',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setSelectedProduct(prod);
                      setIsPhotoZoomed(false);
                    }}
                    title="Click to view full product details"
                  >
                    {prod.imageUrl || prod.images?.[0]?.url ? (
                      <img
                        src={getImageUrl(prod.imageUrl || prod.images[0].url)}
                        alt={prod.productName}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://placehold.co/400x200?text=Product+Image';
                        }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <span style={{ fontSize: '36px' }}>📦</span>
                        <div style={{ fontSize: '11px', marginTop: '4px' }}>Verified Catalog Spec</div>
                      </div>
                    )}
                    <span
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        backgroundColor: prod.availableQuantity > 10 ? 'rgba(16, 185, 129, 0.92)' : prod.availableQuantity > 0 ? 'rgba(245, 158, 11, 0.92)' : 'rgba(239, 68, 68, 0.92)',
                        color: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >
                      {prod.availableQuantity > 0 ? `● ${prod.availableQuantity} In Stock` : '○ Out of Stock'}
                    </span>
                  </div>

                  {/* Category & Vendor Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        backgroundColor: 'rgba(30, 58, 138, 0.08)',
                        color: 'var(--color-primary)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {prod.category}
                    </span>
                    <Badge variant="success" size="sm">
                      Approved Vendor
                    </Badge>
                  </div>

                  {/* Product Title */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: 'var(--spacing-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.3, margin: 0 }}>
                      {prod.productName}
                    </h3>
                    {prod.asin && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          backgroundColor: '#fff7ed',
                          color: '#c2410c',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                          border: '1px solid #fed7aa',
                        }}
                        title={`Amazon India ASIN: ${prod.asin}`}
                      >
                        🛒 {prod.asin}
                      </span>
                    )}
                    {prod.masterCatalogId && !prod.asin && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(30, 58, 138, 0.1)',
                          color: 'var(--color-primary)',
                          padding: '2px 5px',
                          borderRadius: '3px',
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                        title={`Verified Master Catalog Item: ${prod.masterCatalogId}`}
                      >
                        CATALOG
                      </span>
                    )}
                  </div>

                  {/* Vendor Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-3)' }}>
                    {prod.vendor?.shopImage ? (
                      <img
                        src={getImageUrl(prod.vendor.shopImage)}
                        alt=""
                        style={{ width: '18px', height: '18px', minWidth: '18px', borderRadius: '4px', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                        }}
                      />
                    ) : null}
                    <span style={{ display: prod.vendor?.shopImage ? 'none' : 'inline', fontSize: '12px' }}>🏢</span>
                    <strong>{prod.vendor?.companyName || 'Verified Supplier'}</strong>
                  </div>

                  {/* Description Snippet */}
                  {prod.description && (
                    <p
                      style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-light)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        marginBottom: 'var(--spacing-4)',
                        lineHeight: 1.4,
                      }}
                    >
                      {prod.description}
                    </p>
                  )}

                  {/* Price & Delivery Highlights */}
                  <div
                    style={{
                      marginTop: 'auto',
                      padding: 'var(--spacing-3)',
                      backgroundColor: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--spacing-4)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Supplier Price
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: 'var(--color-primary)' }}>
                        ₹{Number(prod.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {prod.marketPrice > 0 ? (
                        <div style={{ fontSize: '10px', color: '#c2410c', marginTop: '1px', fontWeight: 600 }}>
                          Amazon: ₹{Number(prod.marketPrice).toLocaleString('en-IN')}
                          {prod.price !== prod.marketPrice && (
                            <span
                              style={{
                                marginLeft: '4px',
                                fontSize: '9px',
                                fontWeight: 700,
                                color: prod.price < prod.marketPrice ? '#059669' : '#d97706',
                              }}
                            >
                              ({prod.price < prod.marketPrice ? `₹${(prod.marketPrice - prod.price).toLocaleString('en-IN')} below` : `₹${(prod.price - prod.marketPrice).toLocaleString('en-IN')} above`})
                            </span>
                          )}
                        </div>
                      ) : prod.referencePrice > 0 ? (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                          Ref: ₹{Number(prod.referencePrice).toLocaleString('en-IN')}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Delivery SLA
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                        ⚡ {prod.deliveryDays} {prod.deliveryDays === 1 ? 'day' : 'days'}
                      </div>
                    </div>
                  </div>

                  {/* Stock & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: prod.availableQuantity <= 5 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                      Stock: <strong>{prod.availableQuantity} {prod.unit}</strong>
                    </span>

                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      <button
                        type="button"
                        onClick={() => toggleComparison(prod)}
                        className={`btn btn-xs ${isCompared ? 'btn-primary' : 'btn-outline'}`}
                        style={{ fontSize: '11px', padding: '0.25rem 0.5rem' }}
                      >
                        {isCompared ? '✓ Added' : '+ Compare'}
                      </button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProduct(prod)}
                        style={{ fontSize: '11px', padding: '0.25rem 0.5rem' }}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-2)', width: '56px', textAlign: 'center', fontWeight: 600, color: 'var(--color-text-muted)' }}>Image</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Product</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Supplier</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>In Stock</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'center' }}>Delivery</th>
                  <th style={{ padding: 'var(--spacing-3) var(--spacing-4)', fontWeight: 600, color: 'var(--color-text-muted)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => {
                  const isCompared = comparisonList.some((p) => p._id === prod._id);
                  return (
                    <tr
                      key={prod._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: isCompared ? 'rgba(30, 58, 138, 0.04)' : 'transparent',
                      }}
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
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{prod.productName}</span>
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
                              title={`Master Catalog ID: ${prod.masterCatalogId}`}
                            >
                              CATALOG
                            </span>
                          )}
                        </div>
                        {prod.specifications && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '2px' }}>
                            {prod.specifications}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{prod.vendor?.companyName}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {prod.vendor?.city}, {prod.vendor?.state}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {prod.category}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                        <div>₹{Number(prod.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        {prod.referencePrice > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: '1px' }}>
                            Ref: ₹{Number(prod.referencePrice).toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center', fontWeight: 600 }}>
                        {prod.availableQuantity} {prod.unit}
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        {prod.deliveryDays} d
                      </td>
                      <td style={{ padding: 'var(--spacing-3) var(--spacing-4)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--spacing-2)' }}>
                          <button
                            type="button"
                            onClick={() => toggleComparison(prod)}
                            className={`btn btn-xs ${isCompared ? 'btn-primary' : 'btn-outline'}`}
                            style={{ fontSize: '11px' }}
                          >
                            {isCompared ? '✓' : '+ Compare'}
                          </button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedProduct(prod)} style={{ fontSize: '11px' }}>
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Server-Side Pagination Bar */}
      {!loading && pagination.total > 0 && (
        <Card style={{ marginTop: 'var(--spacing-4)' }}>
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            itemLabel="products"
            pageSizeOptions={[12, 24, 48]}
          />
        </Card>
      )}

      {/* Floating Comparison Tray */}
      {comparisonList.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-xl)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-3) var(--spacing-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-4)',
            zIndex: 900,
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>
              Compare Selected ({comparisonList.length}/3)
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {comparisonList.map((p) => p.productName).join(' vs ')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <Button variant="primary" size="sm" onClick={() => setComparisonModalOpen(true)}>
              View Side-by-Side
            </Button>
            <Button variant="outline" size="sm" onClick={clearComparison}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
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
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                padding: 'var(--spacing-4) var(--spacing-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: '4px' }}>
                  <Badge variant="success">Approved Supplier Product</Badge>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-primary)' }}>
                    {selectedProduct.category}
                  </span>
                </div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  {selectedProduct.productName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
              {/* Product Image Header */}
              {(selectedProduct.imageUrl || selectedProduct.images?.[0]?.url) && (
                <div
                  style={{
                    position: 'relative',
                    minHeight: '220px',
                    maxHeight: '300px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    marginBottom: 'var(--spacing-5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border)',
                    padding: 'var(--spacing-3)',
                    cursor: 'zoom-in',
                  }}
                  onClick={() => setIsPhotoZoomed(true)}
                  title="Click to view full size product image"
                >
                  <img
                    src={getImageUrl(selectedProduct.imageUrl || selectedProduct.images[0].url)}
                    alt={selectedProduct.productName}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '270px',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(4px)',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      pointerEvents: 'none',
                    }}
                  >
                    <span>🔍</span> Click to Enlarge
                  </div>
                </div>
              )}

              {/* Pricing & Commercial Terms */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--spacing-4)',
                  padding: 'var(--spacing-4)',
                  backgroundColor: 'var(--color-bg)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-5)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Supplier Price</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-primary)' }}>
                    ₹{Number(selectedProduct.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {selectedProduct.referencePrice > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Catalog Ref: <strong>₹{Number(selectedProduct.referencePrice).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>In-Stock Stock</div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {selectedProduct.availableQuantity} {selectedProduct.unit}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>Fulfillment SLA</div>
                  <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {selectedProduct.deliveryDays} days delivery
                  </div>
                </div>
              </div>

              {/* Vendor Information with Shop Photo */}
              <div style={{ marginBottom: 'var(--spacing-5)', padding: 'var(--spacing-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    minWidth: '56px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    backgroundColor: 'var(--color-bg)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {selectedProduct.vendor?.shopImage ? (
                    <img
                      src={getImageUrl(selectedProduct.vendor.shopImage)}
                      alt={selectedProduct.vendor.companyName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'inline';
                      }}
                    />
                  ) : null}
                  <span style={{ display: selectedProduct.vendor?.shopImage ? 'none' : 'inline', fontSize: '24px' }}>🏢</span>
                </div>
                <div>
                  <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', margin: '0 0 2px 0' }}>
                    Supplier Credentials
                  </h4>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {selectedProduct.vendor?.companyName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Contact: {selectedProduct.vendor?.contactPerson} &bull; {selectedProduct.vendor?.email} &bull; {selectedProduct.vendor?.phone}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    Location: {selectedProduct.vendor?.city}, {selectedProduct.vendor?.state}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>
                    Product Description
                  </h4>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-main)', lineHeight: 1.5 }}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              {/* Specifications */}
              {selectedProduct.specifications && (
                <div>
                  <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-1)' }}>
                    Technical Specifications
                  </h4>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-main)', backgroundColor: 'var(--color-bg)', padding: 'var(--spacing-3)', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
                    {selectedProduct.specifications}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {comparisonModalOpen && (
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
              maxWidth: '950px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              style={{
                padding: 'var(--spacing-4) var(--spacing-6)',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
                  Product Evaluation & Comparison Matrix
                </h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Comparing {comparisonList.length} products side-by-side for procurement decision making.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComparisonModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 'var(--font-size-xl)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ width: '25%', padding: 'var(--spacing-3)', color: 'var(--color-text-muted)' }}>Comparison Metric</th>
                      {comparisonList.map((p) => (
                        <th key={p._id} style={{ width: `${75 / comparisonList.length}%`, padding: 'var(--spacing-3)', color: 'var(--color-primary)' }}>
                          <div style={{ fontWeight: 800, fontSize: 'var(--font-size-base)' }}>{p.productName}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                            {p.vendor?.companyName}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Product Photo</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)' }}>
                          <div
                            style={{
                              width: '90px',
                              height: '90px',
                              borderRadius: 'var(--radius-md)',
                              overflow: 'hidden',
                              backgroundColor: '#ffffff',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px',
                            }}
                          >
                            {p.imageUrl || p.images?.[0]?.url ? (
                              <img
                                src={getImageUrl(p.imageUrl || p.images[0].url)}
                                alt={p.productName}
                                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <span style={{ fontSize: '24px' }}>📦</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Unit Price</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontWeight: 800, fontSize: 'var(--font-size-base)', color: 'var(--color-primary)' }}>
                          <div>₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          {p.referencePrice > 0 && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500, marginTop: '1px' }}>
                              Ref: ₹{Number(p.referencePrice).toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Category</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontWeight: 600 }}>
                          {p.category}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Available Stock</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontWeight: 600 }}>
                          {p.availableQuantity} {p.unit}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Delivery SLA</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontWeight: 700, color: 'var(--color-accent)' }}>
                          ⚡ {p.deliveryDays} {p.deliveryDays === 1 ? 'day' : 'days'}
                        </td>
                      ))}
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Specifications</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', lineHeight: 1.4 }}>
                          {p.specifications || 'Standard specifications'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: 'var(--spacing-3)', fontWeight: 600, color: 'var(--color-text-muted)' }}>Description</td>
                      {comparisonList.map((p) => (
                        <td key={p._id} style={{ padding: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', lineHeight: 1.4 }}>
                          {p.description || 'N/A'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: 'var(--spacing-4) var(--spacing-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="outline" size="sm" onClick={() => setComparisonModalOpen(false)}>
                Close Matrix
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Fullscreen Product Photo Lightbox */}
      {isPhotoZoomed && selectedProduct && (selectedProduct.imageUrl || selectedProduct.images?.[0]?.url) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-4)',
          }}
          onClick={() => setIsPhotoZoomed(false)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                marginBottom: 'var(--spacing-2)',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📦</span>
                <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>
                  {selectedProduct.productName} — Official Product Photo
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={getImageUrl(selectedProduct.imageUrl || selectedProduct.images[0].url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#93c5fd',
                    fontSize: 'var(--font-size-xs)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  ↗ Open Original
                </a>
                <button
                  type="button"
                  onClick={() => setIsPhotoZoomed(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-4)',
              }}
            >
              <img
                src={getImageUrl(selectedProduct.imageUrl || selectedProduct.images[0].url)}
                alt={selectedProduct.productName}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcurementProductsPage;
