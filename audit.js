const AuditLog = require("../models/AuditLog");

// Awaited on purpose: if the audit entry cannot be written, the caller returns an error instead of hiding it.
// Limitation: the state change and its audit entry are not in one database transaction.
exports.audit = (req, { entityType, entityId, event, meta }) =>
  AuditLog.create({ actorId: req.user && req.user.id, actorRole: req.user && req.user.role, entityType, entityId: String(entityId), event, meta: meta || {}, at: new Date() });
