const { User, UserRoles } = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { sanitizeString, escapeRegex, toSafeInteger } = require('../utils/sanitize');
const auditService = require('../services/auditService');

/**
 * Admin-only provisioning of a Procurement Manager account
 * The role is strictly enforced internally as PROCUREMENT_MANAGER.
 * @route POST /api/users/procurement-manager
 * @access ADMIN
 */
const createProcurementManager = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, 400, 'Please provide name, email, and initial password');
    }

    const trimmedName = sanitizeString(name);
    const normalizedEmail = email.toLowerCase().trim();

    // Basic email format check
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return errorResponse(res, 400, 'Please provide a valid email address');
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters long');
    }

    // Check email uniqueness across all users
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse(res, 400, 'An account with this email address already exists');
    }

    // Create user with strictly locked PROCUREMENT_MANAGER role
    const newManager = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password, // Hashed automatically by pre-save hook in User model
      role: UserRoles.PROCUREMENT_MANAGER,
      isActive: true,
    });

    // Record non-sensitive Audit Log entry
    await auditService.log({
      user: req.user,
      action: 'PROCUREMENT_MANAGER_CREATED',
      entityType: 'User',
      entityId: newManager._id,
      description: `Administrator ${req.user.name} created Procurement Manager account for ${newManager.name} (${newManager.email})`,
      metadata: {
        createdUserId: newManager._id,
        name: newManager.name,
        email: newManager.email,
        role: newManager.role,
      },
    });

    return successResponse(res, 201, 'Procurement Manager account created successfully', {
      user: newManager.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin-only query endpoint to retrieve system accounts with filtering and pagination
 * @route GET /api/users
 * @access ADMIN
 */
const getUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = 'ALL',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const safePage = toSafeInteger(page, 1, 1);
    const safeLimit = toSafeInteger(limit, 10, 1, 100);

    const query = {};

    // Role filtering
    if (role && role !== 'ALL') {
      const upperRole = role.toUpperCase();
      if (Object.values(UserRoles).includes(upperRole)) {
        query.role = upperRole;
      }
    }

    // Search query by name or email
    if (search && search.trim()) {
      const sanitizedSearch = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    const sortOptions = {};
    const validSortFields = ['name', 'email', 'role', 'createdAt', 'isActive'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    sortOptions[field] = sortOrder === 'asc' ? 1 : -1;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort(sortOptions)
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .select('-password');

    const totalPages = Math.ceil(total / safeLimit) || 1;

    return successResponse(res, 200, 'Users retrieved successfully', {
      users,
      count: users.length,
      total,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
        hasPrevPage: safePage > 1,
        hasNextPage: safePage < totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProcurementManager,
  getUsers,
};
