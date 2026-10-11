const crypto = require("crypto");

// 6-digit code from a cryptographically secure source (Math.random is predictable).
module.exports = () => crypto.randomInt(100000, 1000000).toString();
