const { User, UserRoles } = require('../models/User');
const { Vendor, OnboardingStatus } = require('../models/Vendor');
const { Notification, NotificationType } = require('../models/Notification');
const { generateToken } = require('../utils/token');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditService = require('../services/auditService');

/**
 * Register a new user
 * Note: Public registration strictly defaults to the VENDOR role.
 * Privileged accounts (ADMIN, PROCUREMENT_MANAGER) cannot be self-assigned.
 * In Phase 5, vendor registration creates both the User account and the linked Vendor document.
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = UserRoles.VENDOR,
      companyName,
      phone,
      address,
      city,
      state,
      country,
      taxId,
      businessDescription,
    } = req.body;

    // Validate presence of required fields
    if (!name || !email || !password) {
      return errorResponse(res, 400, 'Please provide name, email, and password');
    }

    if (password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters long');
    }

    // Protect privileged roles from self-assignment
    const requestedRole = (role || UserRoles.VENDOR).toUpperCase();
    if (requestedRole === UserRoles.ADMIN || requestedRole === UserRoles.PROCUREMENT_MANAGER) {
      return errorResponse(
        res,
        403,
        'Privileged accounts (ADMIN, PROCUREMENT_MANAGER) cannot be self-registered.'
      );
    }

    if (![UserRoles.EMPLOYEE, UserRoles.VENDOR].includes(requestedRole)) {
      return errorResponse(res, 400, 'Invalid registration role. Allowed roles: EMPLOYEE, VENDOR');
    }

    // Check for duplicate email in User accounts
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse(res, 400, 'An account with this email address already exists');
    }

    // If registering as EMPLOYEE:
    if (requestedRole === UserRoles.EMPLOYEE) {
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: UserRoles.EMPLOYEE,
        isActive: true,
      });

      const token = generateToken(user);

      await auditService.log({
        user,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user._id,
        description: `Employee account ${user.name} (${user.email}) registered successfully`,
        metadata: { role: user.role, email: user.email },
      });

      return successResponse(res, 201, 'Employee registration successful', {
        user: user.toJSON(),
        token,
      });
    }

    // If registering as VENDOR:
    // Prepare vendor details with robust fallbacks
    const resolvedCompanyName = companyName?.trim() || `${name.trim()} Enterprises`;
    const resolvedContactPerson = name.trim();
    const resolvedPhone = phone?.trim() || '+1-555-0100';
    const resolvedAddress = address?.trim() || '100 Enterprise Way';
    const resolvedCity = city?.trim() || 'Austin';
    const resolvedState = state?.trim() || 'Texas';
    const resolvedCountry = country?.trim() || 'United States';
    const resolvedTaxId = taxId?.trim() || `TAX-${Date.now().toString().slice(-6)}`;
    const resolvedBusinessDesc = businessDescription?.trim() || 'Registered supplier on VENDORFLOW network';

    // Check for duplicate vendor profile by email or taxId
    const existingVendor = await Vendor.findOne({
      $or: [{ email: normalizedEmail }, { taxId: resolvedTaxId }],
    });
    if (existingVendor) {
      return errorResponse(res, 400, 'A vendor with this email or Tax ID already exists');
    }

    // Create user with safe VENDOR role
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: UserRoles.VENDOR,
      isActive: true,
    });

    let vendor;
    try {
      // Create linked Vendor document in PENDING onboarding status
      vendor = await Vendor.create({
        companyName: resolvedCompanyName,
        contactPerson: resolvedContactPerson,
        email: normalizedEmail,
        phone: resolvedPhone,
        address: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        country: resolvedCountry,
        taxId: resolvedTaxId,
        businessDescription: resolvedBusinessDesc,
        onboardingStatus: OnboardingStatus.PENDING,
        createdBy: user._id,
      });
    } catch (vendorError) {
      // Rollback user creation to prevent orphaned accounts
      await User.findByIdAndDelete(user._id);
      throw vendorError;
    }

    // Notify Admins and Procurement Managers of new vendor registration
    try {
      const adminAndProc = await User.find({
        role: { $in: [UserRoles.ADMIN, UserRoles.PROCUREMENT_MANAGER] },
      });
      for (const u of adminAndProc) {
        await Notification.create({
          recipient: u._id,
          title: 'New Vendor Registration',
          message: `New supplier '${vendor.companyName}' has registered and requires onboarding review.`,
          type: NotificationType.WARNING,
          link: '/vendors',
          metadata: {
            vendorId: vendor._id,
            companyName: vendor.companyName,
            type: 'VENDOR_REGISTERED',
          },
        });
      }
    } catch {
      // Non-blocking notification
    }

    const token = generateToken(user);

    await auditService.log({
      user,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: user._id,
      description: `Vendor user account ${user.name} (${user.email}) registered`,
      metadata: { role: user.role, email: user.email },
    });

    await auditService.log({
      user,
      action: 'VENDOR_REGISTERED',
      entityType: 'Vendor',
      entityId: vendor._id,
      description: `Vendor profile '${vendor.companyName}' registered with onboarding status PENDING`,
      metadata: { companyName: vendor.companyName, email: vendor.email },
    });

    return successResponse(res, 201, 'Vendor registration successful', {
      user: user.toJSON(),
      vendor,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log in an existing user
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Please provide both email and password');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Query user and explicitly include password hash for verification
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      await auditService.log({
        action: 'USER_LOGIN_FAILED',
        entityType: 'User',
        description: `Failed login attempt: account not found for '${normalizedEmail}'`,
        metadata: { email: normalizedEmail },
      });
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Verify password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await auditService.log({
        userId: user._id,
        action: 'USER_LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id,
        description: `Failed login attempt: incorrect password for '${normalizedEmail}'`,
        metadata: { email: normalizedEmail },
      });
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Verify active account status
    if (!user.isActive) {
      await auditService.log({
        userId: user._id,
        action: 'USER_LOGIN_FAILED',
        entityType: 'User',
        entityId: user._id,
        description: `Failed login attempt: account is deactivated for '${normalizedEmail}'`,
        metadata: { email: normalizedEmail },
      });
      return errorResponse(res, 401, 'Account has been deactivated. Please contact an administrator.');
    }

    const token = generateToken(user);

    await auditService.log({
      user,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user._id,
      description: `User ${user.name} logged in successfully as ${user.role}`,
      metadata: { email: user.email, role: user.role },
    });

    return successResponse(res, 200, 'Login successful', {
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * @route GET /api/auth/me
 */
const getMe = async (req, res) => {
  return successResponse(res, 200, 'User profile retrieved successfully', {
    user: req.user,
  });
};

module.exports = {
  register,
  login,
  getMe,
};
