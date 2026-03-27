const { sql, initDb } = require('../lib/db');
const { getUserId } = require('../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { accomplished, went_well_poorly } = req.body;
    if (!accomplished || !went_well_poorly) return res.status(400).json({ error: 'All fields are required' });

    await initDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const existing = await sql`SELECT * FROM checkins WHERE user_id = ${userId} AND date = ${today}`;
    if (existing.rows.length === 0) return res.status(400).json({ error: 'Must check in first' });
    if (existing.rows[0].check_out_time) return res.status(400).json({ error: 'Already checked out today' });

    await sql`
        UPDATE checkins SET check_out_time=${now}, accomplished=${accomplished}, went_well_poorly=${went_well_poorly}
        WHERE user_id=${userId} AND date=${today}
    `;

    const { rows } = await sql`
        SELECT c.*, u.name, u.picture FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ${userId} AND c.date = ${today}
    `;

    res.json({ success: true, checkin: rows[0] });
};
