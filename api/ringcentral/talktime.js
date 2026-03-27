const { rcGet, rcPost } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toISOString().split('T')[0];
    const debug = req.query.debug === '1';

    try {
        // 1. Fetch ALL extensions
        const extensions = {};
        const allExtensions = [];

        try {
            let page = 1;
            let hasMore = true;
            while (hasMore && page <= 10) {
                const extData = await rcGet('/restapi/v1.0/account/~/extension', {
                    perPage: '1000',
                    page: String(page),
                });
                const recs = Array.isArray(extData.records) ? extData.records : [];
                for (let i = 0; i < recs.length; i++) {
                    const ext = recs[i];
                    const id = String(ext.id);
                    const entry = {
                        id: id,
                        name: ext.name || ('Ext ' + (ext.extensionNumber || id)),
                        extensionNumber: ext.extensionNumber || '',
                        type: ext.type || '',
                        status: ext.status || '',
                    };
                    extensions[id] = entry;
                    allExtensions.push(entry);
                }
                hasMore = extData.paging ? (extData.paging.page < extData.paging.totalPages) : false;
                page++;
            }
        } catch (extErr) {
            console.error('Extensions fetch error:', extErr);
        }

        allExtensions.sort(function(a, b) { return a.name.localeCompare(b.name); });

        // 2. Fetch analytics data
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const timeTo = (date >= todayStr) ? now.toISOString() : date + 'T23:59:59.999Z';

        let analyticsData = null;
        let analyticsError = null;

        try {
            analyticsData = await rcPost('/analytics/calls/v1/accounts/~/aggregation/fetch', {
                grouping: {
                    groupBy: 'Users',
                },
                timeSettings: {
                    timeZone: 'America/Chicago',
                    timeRange: {
                        timeFrom: date + 'T00:00:00.000Z',
                        timeTo: timeTo,
                    },
                },
                responseOptions: {
                    counters: {
                        allCalls: { aggregationType: 'Sum' },
                    },
                    timers: {
                        allCallsDuration: { aggregationType: 'Sum' },
                        callsSegmentsDuration: { aggregationType: 'Sum' },
                    },
                },
            });
        } catch (analyticsErr) {
            analyticsError = analyticsErr.message;
            console.error('Analytics error:', analyticsErr);
        }

        // 3. Build stats — initialize everyone at 0
        const stats = {};
        for (let i = 0; i < allExtensions.length; i++) {
            const ext = allExtensions[i];
            stats[ext.id] = {
                id: ext.id,
                name: ext.name,
                extensionNumber: ext.extensionNumber,
                type: ext.type,
                status: ext.status,
                calls: 0,
                talkTime: 0,
            };
        }

        // 4. Fill in analytics data if we got it
        if (analyticsData) {
            // Find the records array in whatever shape the response comes
            var records = null;
            if (Array.isArray(analyticsData.data)) {
                records = analyticsData.data;
            } else if (Array.isArray(analyticsData.records)) {
                records = analyticsData.records;
            } else if (analyticsData.data && Array.isArray(analyticsData.data.records)) {
                records = analyticsData.data.records;
            }

            if (records && Array.isArray(records)) {
                for (var i = 0; i < records.length; i++) {
                    var record = records[i];
                    var extId = (record.key && record.key.extensionId) ? String(record.key.extensionId) : null;
                    if (!extId) continue;

                    var calls = (record.counters && record.counters.allCalls && record.counters.allCalls.sum) ? record.counters.allCalls.sum : 0;
                    var segDur = (record.timers && record.timers.callsSegmentsDuration && record.timers.callsSegmentsDuration.sum) ? record.timers.callsSegmentsDuration.sum : 0;
                    var allDur = (record.timers && record.timers.allCallsDuration && record.timers.allCallsDuration.sum) ? record.timers.allCallsDuration.sum : 0;
                    var duration = segDur || allDur;

                    if (stats[extId]) {
                        stats[extId].calls = calls;
                        stats[extId].talkTime = duration;
                    } else {
                        stats[extId] = {
                            id: extId,
                            name: 'Extension ' + extId,
                            extensionNumber: '',
                            type: '',
                            status: '',
                            calls: calls,
                            talkTime: duration,
                        };
                        allExtensions.push(stats[extId]);
                    }
                }
            }
        }

        // 5. Build leaderboard sorted by talk time
        var leaderboard = [];
        var keys = Object.keys(stats);
        for (var k = 0; k < keys.length; k++) {
            leaderboard.push(stats[keys[k]]);
        }
        leaderboard.sort(function(a, b) { return b.talkTime - a.talkTime; });

        var totalCalls = 0;
        var totalTalkTime = 0;
        for (var t = 0; t < leaderboard.length; t++) {
            totalCalls += leaderboard[t].calls;
            totalTalkTime += leaderboard[t].talkTime;
        }

        allExtensions.sort(function(a, b) { return a.name.localeCompare(b.name); });

        var response = {
            date: date,
            leaderboard: leaderboard,
            allExtensions: allExtensions,
            totalCalls: totalCalls,
            totalTalkTime: totalTalkTime,
            extensionCount: allExtensions.length,
            lastUpdated: new Date().toISOString(),
        };

        if (analyticsError) {
            response.analyticsError = analyticsError;
        }

        if (debug && analyticsData) {
            // Show a trimmed snapshot of the analytics response so we can see its shape
            var snapshot = JSON.stringify(analyticsData).slice(0, 1000);
            response._analyticsSnapshot = snapshot;
            response._recordsFound = records ? records.length : 0;
        }

        res.json(response);
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
