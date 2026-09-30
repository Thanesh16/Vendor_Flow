const connectDB = require('../config/database');
const { User, UserRoles } = require('../models/User');
const { Vendor } = require('../models/Vendor');
const { Product } = require('../models/Product');
const { PurchaseRequest } = require('../models/PurchaseRequest');
const { PurchaseOrder } = require('../models/PurchaseOrder');
const { Receipt } = require('../models/Receipt');
const { Evaluation } = require('../models/Evaluation');
const { Notification } = require('../models/Notification');
const { Document } = require('../models/Document');
const { AuditLog } = require('../models/AuditLog');

const seedUsers = async () => {
  try {
    await connectDB();

    console.log('[Seed] Setting up clean VENDORFLOW environment with designated official accounts...');

    const ALLOWED_EMAILS = ['thaneshselvam4@gmail.com', 'sanjai12@gmail.com'];

    // 1. Remove all users except the two designated official accounts
    const deleteResult = await User.deleteMany({ email: { $nin: ALLOWED_EMAILS } });
    console.log(`[Seed] Removed ${deleteResult.deletedCount} non-official user account(s).`);

    // 2. Remove all transactional collections so Employee and Vendor accounts can be registered fresh
    await Vendor.deleteMany({});
    await Product.deleteMany({});
    await PurchaseRequest.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await Receipt.deleteMany({});
    await Evaluation.deleteMany({});
    await Document.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    console.log('[Seed] Cleared transactional data: vendors, products, PRs, POs, receipts, evaluations, documents, notifications, audit logs.');

    const defaultPassword = process.env.INITIAL_SEED_PASSWORD || 'PleaseSetStrongPasswordInEnv!';

    // 3. Upsert Admin: thaneshselvam4@gmail.com
    const adminEmail = 'thaneshselvam4@gmail.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = await User.create({
        name: 'Thanesh Selvam (Admin)',
        email: adminEmail,
        password: defaultPassword,
        role: UserRoles.ADMIN,
        isActive: true,
      });
      console.log(`[Seed] Created official ADMIN account: ${adminEmail}`);
    } else {
      admin.name = 'Thanesh Selvam (Admin)';
      admin.role = UserRoles.ADMIN;
      admin.isActive = true;
      await admin.save();
      console.log(`[Seed] Verified official ADMIN account: ${adminEmail}`);
    }

    // 4. Upsert Procurement Manager: sanjai12@gmail.com
    const pmEmail = 'sanjai12@gmail.com';
    let pm = await User.findOne({ email: pmEmail });
    if (!pm) {
      pm = await User.create({
        name: 'Sanjai (Procurement Manager)',
        email: pmEmail,
        password: defaultPassword,
        role: UserRoles.PROCUREMENT_MANAGER,
        isActive: true,
      });
      console.log(`[Seed] Created official PROCUREMENT_MANAGER account: ${pmEmail}`);
    } else {
      pm.name = 'Sanjai (Procurement Manager)';
      pm.role = UserRoles.PROCUREMENT_MANAGER;
      pm.isActive = true;
      await pm.save();
      console.log(`[Seed] Verified official PROCUREMENT_MANAGER account: ${pmEmail}`);
    }

    console.log('====================================================');
    console.log('[Seed] VENDORFLOW Fresh Environment Ready:');
    console.log(`  1. ADMIN:               ${adminEmail}`);
    console.log(`  2. PROCUREMENT_MANAGER: ${pmEmail}`);
    console.log('  Remaining accounts (EMPLOYEE, VENDOR) will be created by you.');
    console.log('====================================================');

    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding users:', error.message);
    process.exit(1);
  }
};

seedUsers();
