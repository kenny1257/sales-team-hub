const { clearAuthCookie } = require('../../lib/auth');

module.exports = function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    clearAuthCookie(res);
    res.json({ success: true });
};
