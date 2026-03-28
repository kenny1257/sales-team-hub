const { rcGet, rcPost } = require('../../lib/ringcentral');
const { getUserId } = require('../../lib/auth');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const date = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const debug = req.query.debug === '1';

    try {
        var extensions = {};
        var allExtensions = [];

        try {
            var page = 1;
            var hasMore = true;
            while (hasMore && page <= 10) {
                var extData = await rcGet('/restapi/v1.0/account/~/extension', {
                    perPage: '1000',
                    page: String(page),
                });
                var recs = Array.isArray(extData.records) ? extData.records : [];
                for (var ei = 0; ei < recs.length; ei++) {
                    var ext = recs[ei];
                    var id = String(ext.id);
                    var entry = {
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

        var now = new Date();
        var todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
        var timeTo = (date >= todayStr) ? now.toISOString() : date + 'T23:59:59.999Z';

        var analyticsData = null;
        var analyticsError = null;

        try {
            analyticsData = await rcPost('/analytics/calls/v1/accounts/~/aggregation/fetch', {
                grouping: { groupBy: 'Users' },
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
        }

        var stats = {};
        for (var ai = 0; ai < allExtensions.length; ai++) {
            var e = allExtensions[ai];
            stats[e.id] = { id: e.id, name: e.name, extensionNumber: e.extensionNumber, type: e.type, status: e.status, calls: 0, talkTime: 0 };
        }

        var records = null;
        if (analyticsData) {
            var topKeys = Object.keys(analyticsData);
            for (var ti = 0; ti < topKeys.length; ti++) {
                if (Array.isArray(analyticsData[topKeys[ti]])) {
                    records = analyticsData[topKeys[ti]];
                    break;
                }
            }
            if (!records) {
                for (var ti2 = 0; ti2 < topKeys.length; ti2++) {
                    var nested = analyticsData[topKeys[ti2]];
                    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
                        var nestedKeys = Object.keys(nested);
                        for (var ni = 0; ni < nestedKeys.length; ni++) {
                            if (Array.isArray(nested[nestedKeys[ni]])) {
                                records = nested[nestedKeys[ni]];
                                break;
                            }
                        }
                        if (records) break;
                    }
                }
            }
        }

        if (records) {
            for (var ri = 0; ri < records.length; ri++) {
                var rec = records[ri];

                var extId = null;
                if (typeof rec.key === 'string') extId = rec.key;
                else if (typeof rec.key === 'number') extId = String(rec.key);
                else if (rec.key && typeof rec.key === 'object') {
                    var kf = Object.keys(rec.key);
                    if (kf.length > 0) extId = String(rec.key[kf[0]]);
                }
                if (!extId) continue;

                // Call count: counters.allCalls.values
                var calls = 0;
                if (rec.counters && rec.counters.allCalls) {
                    calls = rec.counters.allCalls.values || rec.counters.allCalls.sum || rec.counters.allCalls.value || 0;
                    if (typeof calls === 'object') calls = 0;
                }

                // Duration: timers.allCalls.values (total seconds)
                var duration = 0;
                if (rec.timers && rec.timers.allCalls) {
                    duration = rec.timers.allCalls.values || rec.timers.allCalls.sum || rec.timers.allCalls.value || 0;
                    if (typeof duration === 'object') duration = 0;
                }
                duration = Math.round(duration);

                var repName = (rec.info && rec.info.name) ? rec.info.name : null;

                if (stats[extId]) {
                    stats[extId].calls = calls;
                    stats[extId].talkTime = duration;
                    if (repName) stats[extId].name = repName;
                } else {
                    stats[extId] = {
                        id: extId,
                        name: repName || ('Extension ' + extId),
                        extensionNumber: (rec.info && rec.info.extensionNumber) || '',
                        type: '', status: '',
                        calls: calls,
                        talkTime: duration,
                    };
                    allExtensions.push(stats[extId]);
                }
            }
        }

        var leaderboard = [];
        var sKeys = Object.keys(stats);
        for (var li = 0; li < sKeys.length; li++) {
            leaderboard.push(stats[sKeys[li]]);
        }
        leaderboard.sort(function(a, b) { return b.talkTime - a.talkTime; });

        var totalCalls = 0;
        var totalTalkTime = 0;
        for (var ci = 0; ci < leaderboard.length; ci++) {
            totalCalls += leaderboard[ci].calls;
            totalTalkTime += leaderboard[ci].talkTime;
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

        if (analyticsError) response.analyticsError = analyticsError;

        if (debug) {
            response._recordsFound = records ? records.length : 0;
            if (records && records.length > 0) {
                response._firstRecord = JSON.stringify(records[0]);
            }
        }

        res.json(response);
    } catch (err) {
        console.error('RingCentral error:', err);
        res.status(500).json({ error: 'Failed to fetch talk time data: ' + err.message });
    }
};
