const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { working_on, goal } = req.body;
    if (!working_on || !goal) return res.status(400).json({ error: 'All fields are required' });

    await initDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Check if already checked in
    const existing = await sql`SELECT id FROM checkins WHERE user_id = ${userId} AND date = ${today}`;
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already checked in today' });

    await sql`
        INSERT INTO checkins (user_id, date, check_in_time, working_on, goal)
        VALUES (${userId}, ${today}, ${now}, ${working_on}, ${goal})
    `;

    const { rows } = await sql`
        SELECT c.*, u.name, u.picture FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ${userId} AND c.date = ${today}
    `;

    res.json({ success: true, checkin: rows[0] });
};
