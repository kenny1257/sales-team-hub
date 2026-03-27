const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows } = await sql`SELECT id, name, email, picture, role FROM users WHERE id = ${userId}`;
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ user: rows[0] });
};
