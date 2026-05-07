const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!userRows[0]) return res.status(403).json({ error: 'User not found' });
    const isAdmin = userRows[0].role === 'admin';

    const { id } = req.query;
    const { rows: reqRows } = await sql`SELECT user_id FROM requests WHERE id = ${id}`;
    if (reqRows.length === 0) return res.status(404).json({ error: 'Request not found' });
    if (!isAdmin && reqRows[0].user_id !== userId) {
        return res.status(403).json({ error: 'You can only delete your own requests' });
    }

    await sql`DELETE FROM requests WHERE id = ${id}`;
    res.json({ success: true });
};
