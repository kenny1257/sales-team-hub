const { GOOGLE_CLIENT_ID } = require('../lib/auth');

module.exports = function handler(req, res) {
    res.json({ googleClientId: GOOGLE_CLIENT_ID });
};
