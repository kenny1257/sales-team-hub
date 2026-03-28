const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();
    const { rows } = await sql`SELECT * FROM sales_tips`;

    if (rows.length === 0) {
        return res.json({ tip: { tip_text: 'No sales tips available yet. Ask your admin to add some!', category: '' } });
    }

    // Consistent daily pick based on date hash
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    let hash = 0;
    for (let i = 0; i < today.length; i++) {
        hash = ((hash << 5) - hash) + today.charCodeAt(i);
        hash |= 0;
    }
    res.json({ tip: rows[Math.abs(hash) % rows.length] });
};
