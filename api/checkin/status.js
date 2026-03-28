const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });

    const { rows } = await sql`
        SELECT c.*, u.name, u.picture FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ${userId} AND c.date = ${today}
    `;

    res.json({ checkin: rows[0] || null });
};
