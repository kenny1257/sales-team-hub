const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!userRows[0] || userRows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { rows } = await sql`
        SELECT r.*, u.name, u.email, u.picture
        FROM requests r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 50
    `;

    res.json({ requests: rows });
};
