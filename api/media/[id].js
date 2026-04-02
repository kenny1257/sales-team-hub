const { del } = require('@vercel/blob');
const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await initDb();

    const { rows: userRows } = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const isAdmin = userRows[0] && userRows[0].role === 'admin';

    const { id } = req.query;

    // GET - single media item
    if (req.method === 'GET') {
        const { rows } = await sql`
            SELECT m.*, u.name as uploaded_by
            FROM media m JOIN users u ON m.user_id = u.id
            WHERE m.id = ${id}
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json({ media: rows[0] });
    }

    // PUT - update media metadata (admin only)
    if (req.method === 'PUT') {
        if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const {
            building_type, width, length, height, color,
            is_advertisement,
            vendor_carport_experts, vendor_us_steel, vendor_eagle,
            vendor_galv_struct, vendor_bluestone
        } = req.body;

        const { rows } = await sql`
            UPDATE media SET
                building_type = ${building_type || null},
                width = ${width || null},
                length = ${length || null},
                height = ${height || null},
                color = ${color || null},
                is_advertisement = ${is_advertisement || false},
                vendor_carport_experts = ${vendor_carport_experts || null},
                vendor_us_steel = ${vendor_us_steel || null},
                vendor_eagle = ${vendor_eagle || null},
                vendor_galv_struct = ${vendor_galv_struct || null},
                vendor_bluestone = ${vendor_bluestone || null}
            WHERE id = ${id}
            RETURNING *
        `;

        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json({ success: true, media: rows[0] });
    }

    // DELETE - remove media (admin only)
    if (req.method === 'DELETE') {
        if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

        const { rows } = await sql`SELECT file_url FROM media WHERE id = ${id}`;
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

        // Delete from Vercel Blob
        try {
            await del(rows[0].file_url);
        } catch { /* blob may already be gone */ }

        // Delete from database
        await sql`DELETE FROM media WHERE id = ${id}`;

        return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
