const { clearAuthCookie } = require('../../lib/auth');

module.exports = function handler(req, res) {
    clearAuthCookie(res);
    res.json({ success: true });
};
