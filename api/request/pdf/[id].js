const { sql, initDb } = require('../../../lib/db');
const { getUserId } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    // Admin can view any; regular users can only view their own
    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const isAdmin = userRows[0] && userRows[0].role === 'admin';

    const { id } = req.query;
    const { rows } = await sql`SELECT pdf_data, pdf_filename, user_id FROM requests WHERE id = ${id}`;

    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && rows[0].user_id !== userId) return res.status(403).json({ error: 'Access denied' });
    if (!rows[0].pdf_data) return res.status(404).json({ error: 'No PDF attached' });

    const buffer = Buffer.from(rows[0].pdf_data, 'base64');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${rows[0].pdf_filename || 'document.pdf'}"`);
    res.send(buffer);
};
