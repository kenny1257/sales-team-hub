const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { energy_start, goal, help_needed } = req.body;
    const energyNum = parseInt(energy_start, 10);
    if (!energyNum || energyNum < 1 || energyNum > 10) return res.status(400).json({ error: 'Energy (1-10) is required' });
    if (!goal || !help_needed) return res.status(400).json({ error: 'All fields are required' });

    await initDb();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const now = new Date().toISOString();

    // Check if already checked in
    const existing = await sql`SELECT id FROM checkins WHERE user_id = ${userId} AND date = ${today}`;
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Already checked in today' });

    await sql`
        INSERT INTO checkins (user_id, date, check_in_time, goal, energy_start, help_needed)
        VALUES (${userId}, ${today}, ${now}, ${goal}, ${energyNum}, ${help_needed})
    `;

    const { rows } = await sql`
        SELECT c.*, u.name, u.picture FROM checkins c
        JOIN users u ON c.user_id = u.id
        WHERE c.user_id = ${userId} AND c.date = ${today}
    `;

    res.json({ success: true, checkin: rows[0] });
};
