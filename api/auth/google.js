const { sql, initDb } = require('../../lib/db');
const { verifyGoogleToken, isAdminEmail, createToken, setAuthCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    try {
        const payload = await verifyGoogleToken(credential);
        const { sub: googleId, email, name, picture } = payload;

        await initDb();

        const role = isAdminEmail(email) ? 'admin' : 'member';

        const { rows } = await sql`
            INSERT INTO users (google_id, email, name, picture, role)
            VALUES (${googleId}, ${email}, ${name}, ${picture || null}, ${role})
            ON CONFLICT (google_id) DO UPDATE SET
                name = EXCLUDED.name,
                picture = EXCLUDED.picture,
                role = ${role}
            RETURNING id, name, email, picture, role
        `;

        const user = rows[0];
        const token = createToken(user.id);
        setAuthCookie(res, token);

        res.json({ success: true, user });
    } catch (err) {
        res.status(401).json({ error: 'Authentication failed' });
    }
};
