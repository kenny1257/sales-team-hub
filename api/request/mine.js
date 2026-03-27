const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    const { rows } = await sql`
        SELECT id, type, manufacturer, needed_by, customer_needs, pdf_filename, status, created_at
        FROM requests
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 20
    `;

    res.json({ requests: rows });
};
