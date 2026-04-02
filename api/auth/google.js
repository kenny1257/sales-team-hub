const { sql, initDb } = require('../../lib/db');
const { verifyGoogleToken, isAdminEmail, createToken, setAuthCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        await initDb();
        const { credential } = req.body;
        const payload = await verifyGoogleToken(credential);
        const { sub: googleId, email, name, picture } = payload;
        const role = isAdminEmail(email) ? 'admin' : 'member';

        // Upsert user
        const existing = await sql`SELECT id FROM users WHERE google_id = ${googleId}`;
        if (existing.rows.length > 0) {
            await sql`UPDATE users SET email=${email}, name=${name}, picture=${picture}, role=${role} WHERE google_id=${googleId}`;
        } else {
            await sql`INSERT INTO users (google_id, email, name, picture, role) VALUES (${googleId}, ${email}, ${name}, ${picture}, ${role})`;
        }

        const { rows } = await sql`SELECT id, name, email, picture, role FROM users WHERE google_id = ${googleId}`;
        const user = rows[0];

        const token = createToken(user.id);
        setAuthCookie(res, token);

        res.json({ success: true, user });
    } catch (err) {
        console.error('Auth error:', err);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
