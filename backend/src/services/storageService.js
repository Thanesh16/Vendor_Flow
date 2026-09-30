const fs = require('fs');
const path = require('path');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { Document } = require('../models/Document');

/**
 * Storage Service
 * Handles uploading and deleting product image assets.
 * Supports Cloudinary cloud storage with automatic local disk fallback.
 */
const storageService = {
  /**
   * Upload product image asset
   * @param {Object} file - Multer file object
   * @param {Object} user - Authenticated user object
   * @returns {Promise<Object>} { url, publicId, storage, originalName, size, mimeType }
   */
  async uploadProductImage(file, user) {
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    let url = '';
    let publicId = '';
    let storageProvider = 'local';

    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'vendorflow/products',
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
        });

        url = result.secure_url;
        publicId = result.public_id;
        storageProvider = 'cloudinary';

        // Clean up temporary local upload file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cloudErr) {
        console.error('[Cloudinary Upload Error]:', cloudErr.message);
        // Fallback to local storage if Cloudinary network/credentials failed
        url = `/uploads/products/${file.filename}`;
        publicId = `local:${file.filename}`;
        storageProvider = 'local';
      }
    } else {
      // Local disk storage fallback
      url = `/uploads/products/${file.filename}`;
      publicId = `local:${file.filename}`;
      storageProvider = 'local';
    }

    // Record document metadata in MongoDB
    try {
      await Document.create({
        originalName: file.originalname,
        fileName: file.filename || path.basename(url),
        url,
        publicId,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user._id,
        relatedEntity: 'Product',
        storageProvider,
      });
    } catch (docErr) {
      console.warn('[Document metadata save warning]:', docErr.message);
    }

    return {
      url,
      publicId,
      storage: storageProvider,
      storageProvider,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  },

  /**
   * Delete asset from storage
   * @param {string} publicId - Cloudinary public_id or local:<filename>
   */
  async deleteProductImage(publicId) {
    if (!publicId) return;

    try {
      if (publicId.startsWith('local:')) {
        const filename = publicId.replace('local:', '');
        const localPath = path.join(__dirname, '../../uploads/products', filename);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } else if (isCloudinaryConfigured) {
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (err) {
      console.warn('[Asset Deletion Warning]:', err.message);
    }
  },

  /**
   * Upload vendor shop image asset
   * @param {Object} file - Multer file object
   * @param {Object} user - Authenticated user object
   * @returns {Promise<Object>} { url, publicId, storage, originalName, size, mimeType }
   */
  async uploadVendorImage(file, user) {
    if (!file) {
      throw new Error('No file provided for upload.');
    }

    let url = '';
    let publicId = '';
    let storageProvider = 'local';

    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'vendorflow/vendors',
          resource_type: 'image',
          transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }],
        });

        url = result.secure_url;
        publicId = result.public_id;
        storageProvider = 'cloudinary';

        // Clean up temporary local upload file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cloudErr) {
        console.error('[Cloudinary Vendor Upload Error]:', cloudErr.message);
        url = `/uploads/vendors/${file.filename}`;
        publicId = `local:${file.filename}`;
        storageProvider = 'local';
      }
    } else {
      url = `/uploads/vendors/${file.filename}`;
      publicId = `local:${file.filename}`;
      storageProvider = 'local';
    }

    // Record document metadata in MongoDB
    try {
      await Document.create({
        originalName: file.originalname,
        fileName: file.filename || path.basename(url),
        url,
        publicId,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user._id,
        relatedEntity: 'Vendor',
        storageProvider,
      });
    } catch (docErr) {
      console.warn('[Document metadata save warning]:', docErr.message);
    }

    return {
      url,
      publicId,
      storage: storageProvider,
      storageProvider,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  },

  /**
   * Delete vendor shop asset from storage
   * @param {string} publicId - Cloudinary public_id or local:<filename>
   */
  async deleteVendorImage(publicId) {
    if (!publicId) return;

    try {
      if (publicId.startsWith('local:')) {
        const filename = publicId.replace('local:', '');
        const localPath = path.join(__dirname, '../../uploads/vendors', filename);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } else if (isCloudinaryConfigured) {
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (err) {
      console.warn('[Vendor Asset Deletion Warning]:', err.message);
    }
  },
};

module.exports = storageService;
