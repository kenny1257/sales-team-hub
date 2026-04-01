const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!userRows[0] || userRows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { id, status } = req.body;
    if (!id || !status) return res.status(400).json({ error: 'Missing id or status' });
    if (!['pending', 'completed', 'on_pause'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: pending, completed, or on_pause' });
    }

    await sql`UPDATE requests SET status = ${status} WHERE id = ${id}`;
    res.json({ success: true, status });
};
