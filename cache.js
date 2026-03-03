// cache.js - FINAL VERSION (100% fixed)
const fs = require('fs-extra');
const path = require('path');
const {
    saveConfigToDB,
    getConfigFromDB,
    getCustomTriggersFromDB,
    saveCustomTriggerToDB,
    getAutopostSettings,
    saveAutopostSetting,
    deleteAutopost,
    getAllNumbersFromDB,
    pool
} = require('./configdb');

const DB_PATH = path.join(__dirname, 'database.json');

// ALWAYS initialize cache objects (never undefined)
let cache = {
    configs: {},
    triggers: {},
    autopost: {}
};

// Safe load
async function loadCache() {
    // Ensure objects exist even before loading
    cache.configs = cache.configs || {};
    cache.triggers = cache.triggers || {};
    cache.autopost = cache.autopost || {};

    if (fs.existsSync(DB_PATH)) {
        try {
            const data = await fs.readJson(DB_PATH);
            // Merge safely
            cache.configs = { ...cache.configs, ...data.configs };
            cache.triggers = { ...cache.triggers, ...data.triggers };
            cache.autopost = { ...cache.autopost, ...data.autopost };
            console.log('✅ Local cache loaded & merged from database.json');
        } catch (err) {
            console.error('❌ Corrupted database.json! Recovering...');
            fs.copySync(DB_PATH, DB_PATH + '.corrupt.' + Date.now());
            // Keep empty objects
            console.log('🆕 Continuing with empty cache');
        }
    } else {
        console.log('🆕 No database.json found - starting with empty cache');
    }
    await saveCache(); // ensure file exists
}

// Save
async function saveCache() {
    try {
        await fs.writeJson(DB_PATH, {
            configs: cache.configs,
            triggers: cache.triggers,
            autopost: cache.autopost
        }, { spaces: 2 });
    } catch (err) {
        console.error('❌ Failed to save cache:', err.message);
    }
}

// Getters - safe fallback
function getConfig(number) {
    return cache.configs[number] || { ...require('./index').defaultConfigs };
}

function getTriggers(number) {
    return cache.triggers[number] || {};
}

function getAutopost(number) {
    return cache.autopost[number] || {};
}

// Updates
async function updateConfig(number, newConfig) {
    cache.configs[number] = newConfig;
    await saveCache();
    try { await saveConfigToDB(number, newConfig); } catch (e) { console.warn('PG sync failed:', e.message); }
}

async function updateTriggers(number, newTriggers) {
    cache.triggers[number] = newTriggers;
    await saveCache();
    try {
        await pool.query('DELETE FROM custom_auto_reply_triggers WHERE phone_number = $1', [number]);
        for (const [trigger, data] of Object.entries(newTriggers)) {
            await saveCustomTriggerToDB(number, trigger, data.type, data.content, data.replyType || 'text', data.caption || '');
        }
    } catch (e) { console.warn('Triggers sync failed:', e.message); }
}

async function updateAutopost(number, platform, data) {
    if (!cache.autopost[number]) cache.autopost[number] = {};
    cache.autopost[number][platform] = data;
    await saveCache();
    try {
        await saveAutopostSetting(number, platform, data.jid, data.interval, Array.isArray(data.keywords) ? data.keywords.join(',') : data.keywords);
    } catch (e) { console.warn('Autopost sync failed:', e.message); }
}

async function removeAutopost(number, platform) {
    if (cache.autopost[number]) {
        delete cache.autopost[number][platform];
        if (Object.keys(cache.autopost[number]).length === 0) delete cache.autopost[number];
    }
    await saveCache();
    try { await deleteAutopost(number, platform); } catch (e) { console.warn(e.message); }
}

// Sync from PG
async function syncFromPG() {
    try {
        const allNumbers = await getAllNumbersFromDB() || [];
        console.log(`🔄 Syncing ${allNumbers.length} users from PG...`);

        for (const num of allNumbers) {
            try {
                const cfg = await getConfigFromDB(num);
                if (cfg) cache.configs[num] = cfg;

                const trig = await getCustomTriggersFromDB(num);
                cache.triggers[num] = trig || {};

                const auto = await getAutopostSettings(num);
                cache.autopost[num] = auto || {};
            } catch (e) {
                console.warn(`⚠️ Sync failed for ${num}: ${e.message}`);
            }
        }

        await saveCache();
        console.log(`✅ Sync completed`);
    } catch (err) {
        console.error('❌ syncFromPG error:', err.message);
    }
}

module.exports = {
    loadCache,
    saveCache,
    getConfig,
    getTriggers,
    getAutopost,
    updateConfig,
    updateTriggers,
    updateAutopost,
    removeAutopost,
    syncFromPG,
    cache // optional
};
