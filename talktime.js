const { rcGet } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toISOString().split('T')[0];
    // No 'Z' suffix — RingCentral will use account's local timezone
    const dateFrom = `${date}T00:00:00`;
    const dateTo = `${date}T23:59:59`;

    try {
        // Fetch ALL extensions — no type or status filter so we don't miss anyone
        let allExtRecords = [];
        let extPage = 1;
        let extHasMore = true;
        while (extHasMore && extPage <= 10) {
            const extData = await rcGet('/restapi/v1.0/account/~/extension', {
                perPage: '1000',
                page: String(extPage),
            });
            allExtRecords = allExtRecords.concat(extData.records || []);
            if (extData.paging) {
                extHasMore = extData.paging.page < extData.paging.totalPages;
            } else {
                extHasMore = false;
            }
            extPage++;
        }

        // Build extensions map — include EVERYTHING, no filtering
        const extensions = {};
        const allExtensions = [];
        for (const ext of allExtRecords) {
            const id = String(ext.id);
            const entry = {
                id,
                name: ext.name || ('Ext ' + ext.extensionNumber),
                extensionNumber: ext.extensionNumber || '',
                type: ext.type || '',
                status: ext.status || '',
            };
            extensions[id] = entry;
            allExtensions.push(entry);
        }
        allExtensions.sort((a, b) => a.name.localeCompare(b.name));

        // Fetch account-level call logs with pagination
        let allRecords = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 30) {
            const logData = await rcGet('/restapi/v1.0/account/~/call-log', {
                dateFrom,
                dateTo,
                view: 'Simple',
                perPage: '1000',
                page: String(page),
            });

            allRecords = allRecords.concat(logData.records || []);

            if (logData.paging) {
                hasMore = logData.paging.page < logData.paging.totalPages;
            } else if (logData.navigation && logData.navigation.nextPage) {
                hasMore = true;
            } else {
                hasMore = false;
            }
            page++;
        }

        // Initialize ALL extensions at 0 so everyone shows up
        const stats = {};
        for (const ext of allExtensions) {
            stats[ext.id] = {
                ...ext,
                calls: 0,
                talkTime: 0,
            };
        }

        // Aggregate call log data on top
        for (const record of allRecords) {
            let extId = null;

            if (record.extension && record.extension.id) {
                extId = String(record.extension.id);
            }

            if (!extId) continue;

            // If this extension isn't in our map, add it dynamically
            if (!stats[extId]) {
                const entry = {
                    id: extId,
                    name: 'Extension ' + extId,
                    extensionNumber: '',
                };
                stats[extId] = { ...entry, calls: 0, talkTime: 0 };
                allExtensions.push(entry);
            }

            stats[extId].calls++;
            stats[extId].talkTime += record.duration || 0;
        }

        // Sort by talk time descending
        const leaderboard = Object.values(stats).sort((a, b) => b.talkTime - a.talkTime);

        const totalCalls = leaderboard.reduce((sum, r) => sum + r.calls, 0);
        const totalTalkTime = leaderboard.reduce((sum, r) => sum + r.talkTime, 0);

        // Re-sort allExtensions after any dynamic additions
        allExtensions.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            date,
            leaderboard,
            allExtensions,
            totalCalls,
            totalTalkTime,
            recordCount: allRecords.length,
            extensionCount: allExtensions.length,
            lastUpdated: new Date().toISOString(),
        });
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
