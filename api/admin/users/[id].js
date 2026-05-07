const { sql, initDb } = require('../../../lib/db');
const { getUserId } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!userRows[0] || userRows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const targetId = parseInt(req.query.id, 10);
    if (!targetId) return res.status(400).json({ error: 'Invalid user id' });
    if (targetId === userId) return res.status(400).json({ error: 'You cannot remove yourself' });

    await sql`UPDATE sales_tips SET created_by = NULL WHERE created_by = ${targetId}`;
    await sql`DELETE FROM checkins WHERE user_id = ${targetId}`;
    await sql`DELETE FROM requests WHERE user_id = ${targetId}`;
    await sql`DELETE FROM users WHERE id = ${targetId}`;

    res.json({ success: true });
};
