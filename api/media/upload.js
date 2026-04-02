const { put } = require('@vercel/blob');
const { sql, initDb } = require('../../lib/db');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const {
        file_data, file_name, file_type,
        building_type, width, length, height, color,
        is_advertisement,
        vendor_carport_experts, vendor_us_steel, vendor_eagle,
        vendor_galv_struct, vendor_bluestone
    } = req.body;

    if (!file_data || !file_name) {
        return res.status(400).json({ error: 'File is required' });
    }

    await initDb();

    // Decode base64 and upload to Vercel Blob
    const buffer = Buffer.from(file_data, 'base64');
    const blob = await put(`media/${Date.now()}-${file_name}`, buffer, {
        access: 'public',
        addRandomSuffix: true,
    });

    // Determine media type from extension
    const ext = file_name.split('.').pop().toLowerCase();
    const mediaType = ['mp4', 'mov', 'webm', 'avi'].includes(ext) ? 'video' : 'image';

    const { rows } = await sql`
        INSERT INTO media (
            user_id, file_url, file_name, file_type, file_size,
            building_type, width, length, height, color,
            is_advertisement,
            vendor_carport_experts, vendor_us_steel, vendor_eagle,
            vendor_galv_struct, vendor_bluestone
        ) VALUES (
            ${userId}, ${blob.url}, ${file_name}, ${mediaType}, ${buffer.length},
            ${building_type || null}, ${width || null}, ${length || null}, ${height || null}, ${color || null},
            ${is_advertisement || false},
            ${vendor_carport_experts || null}, ${vendor_us_steel || null}, ${vendor_eagle || null},
            ${vendor_galv_struct || null}, ${vendor_bluestone || null}
        )
        RETURNING *
    `;

    res.json({ success: true, media: rows[0] });
};
