const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!userRows[0] || userRows[0].role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { tip_text, category } = req.body;
    if (!tip_text) return res.status(400).json({ error: 'Tip text is required' });

    await sql`INSERT INTO sales_tips (tip_text, category, created_by) VALUES (${tip_text}, ${category || 'General'}, ${userId})`;
    res.json({ success: true });
};
