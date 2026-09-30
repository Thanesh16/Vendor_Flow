const express = require('express');
const auditLogController = require('../controllers/auditLogController');
const { authenticate, authorize } = require('../middleware/auth');
const { UserRoles } = require('../models/User');

const router = express.Router();

// Audit logs are strictly restricted to ADMIN
router.use(authenticate);
router.use(authorize(UserRoles.ADMIN));

router.get('/', auditLogController.getAuditLogs);
router.get('/filters', auditLogController.getAuditLogFilters);

module.exports = router;
