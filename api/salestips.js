const { sql, initDb } = require('../lib/db');
const { getUserId } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows } = await sql`
        SELECT st.*, u.name as author_name FROM sales_tips st
        LEFT JOIN users u ON st.created_by = u.id
        ORDER BY st.created_at DESC
    `;

    res.json({ tips: rows });
};
