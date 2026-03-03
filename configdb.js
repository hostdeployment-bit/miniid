// configdb.js
const { Pool } = require('pg');
const fs = require('fs-extra');
const path = require('path');

// PostgreSQL Pool (ඔයාගේ existing config එක)
const pool = new Pool({
    user: process.env.DB_USER || 'neondb_owner',
    host: process.env.DB_HOST || 'ep-billowing-dew-afg8al62-pooler.c-2.us-west-2.aws.neon.tech',
    database: process.env.DB_NAME || 'neondb',
    password: process.env.DB_PASSWORD || 'npg_WwmJ7fnAps9G',
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

// Default Configs
const defaultConfigs = {
    ANTI_DELETE: "off",
    ANTI_CALL: "off",
    WORK_TYPE: "public",
    AUTO_REPLY: "on",
    AUTO_VIEW_STATUS: "on",
    AUTO_REACT_STATUS: "on",
    PRESENCE: "available",
    AUTO_READ_MESSAGE: "off",
    AUTO_LIKE_EMOJI: ['💋', '🍬', '🫆', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭'],
    PREFIX: '.',
    BUTTON: 'on'
};

// Ensure DB tables exist (ඔයාගේ original initializeDatabase function එක call කරන්න)
async function ensureDbInitialized() {
    // ඔයාගේ original initializeDatabase() function එක මෙතන call කරන්න
    // await initializeDatabase(); // uncomment if you have it
}

// ================ CONFIG FUNCTIONS (PG) ================
async function saveConfigToDB(number, configData) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        const res = await client.query(
            'SELECT * FROM configs WHERE phone_number = $1',
            [sanitized]
        );
        if (res.rows.length > 0) {
            await client.query(
                'UPDATE configs SET config_data = $1 WHERE phone_number = $2',
                [configData, sanitized]
            );
        } else {
            await client.query(
                'INSERT INTO configs (phone_number, config_data) VALUES ($1, $2)',
                [sanitized, configData]
            );
        }
    } finally {
        client.release();
    }
}

async function getConfigFromDB(number) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        const res = await client.query(
            'SELECT config_data FROM configs WHERE phone_number = $1',
            [sanitized]
        );
        return res.rows.length > 0 ? res.rows[0].config_data : null;
    } finally {
        client.release();
    }
}

// ================ TRIGGERS (PG) ================
async function getCustomTriggersFromDB(number) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        const res = await client.query(
            'SELECT trigger, type, content, reply_type AS replyType, caption FROM custom_auto_reply_triggers WHERE phone_number = $1',
            [sanitized]
        );
        const triggers = {};
        res.rows.forEach(row => {
            triggers[row.trigger] = {
                type: row.type,
                content: row.content,
                replyType: row.replytype,
                caption: row.caption
            };
        });
        return triggers;
    } finally {
        client.release();
    }
}

async function saveCustomTriggerToDB(number, trigger, type, content, replyType, caption = '') {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO custom_auto_reply_triggers 
            (phone_number, trigger, type, content, reply_type, caption)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (phone_number, trigger) DO UPDATE SET
            type = $3, content = $4, reply_type = $5, caption = $6
        `, [sanitized, trigger, type, content, replyType, caption]);
    } finally {
        client.release();
    }
}

async function deleteCustomTriggerFromDB(number, trigger) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        await client.query(
            'DELETE FROM custom_auto_reply_triggers WHERE phone_number = $1 AND trigger = $2',
            [sanitized, trigger]
        );
    } finally {
        client.release();
    }
}

// ================ AUTOPOST (PG) ================
async function getAutopostSettings(number) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        const res = await client.query(
            'SELECT platform, newsletter_jid AS jid, interval_minutes AS interval, keywords FROM autopost_settings WHERE phone_number = $1',
            [sanitized]
        );
        const settings = {};
        res.rows.forEach(row => {
            settings[row.platform] = {
                jid: row.jid,
                interval: row.interval,
                keywords: row.keywords ? row.keywords.split(',').map(k => k.trim()) : []
            };
        });
        return settings;
    } finally {
        client.release();
    }
}

async function saveAutopostSetting(number, platform, jid, interval, keywords) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const keywordsStr = Array.isArray(keywords) ? keywords.join(',') : keywords;
    const client = await pool.connect();
    try {
        await client.query(`
            INSERT INTO autopost_settings (phone_number, platform, newsletter_jid, interval_minutes, keywords)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (phone_number, platform) DO UPDATE SET
            newsletter_jid = $3, interval_minutes = $4, keywords = $5
        `, [sanitized, platform, jid, interval, keywordsStr]);
    } finally {
        client.release();
    }
}

async function deleteAutopost(number, platform) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        await client.query(
            'DELETE FROM autopost_settings WHERE phone_number = $1 AND platform = $2',
            [sanitized, platform]
        );
    } finally {
        client.release();
    }
}

// ================ LEGACY LOCAL JSON (OPTIONAL FALLBACK) ================
async function connectdb(number) {
    // Optional: keep for backward compatibility
    // But we don't use it anymore with cache.js
}

async function initializeSettings(number) {
    await saveConfigToDB(number, { ...defaultConfigs });
}

async function input(setting, data, number) {
    const current = await getConfigFromDB(number) || { ...defaultConfigs };
    current[setting] = data;
    await saveConfigToDB(number, current);
}

async function get(setting, number) {
    const config = await getConfigFromDB(number);
    return config ? config[setting] : null;
}

async function getalls(number) {
    return await getConfigFromDB(number) || { ...defaultConfigs };
}

async function resetSettings(number) {
    await saveConfigToDB(number, { ...defaultConfigs });
}
async function getAllNumbersFromDB() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT phone_number FROM numbers');
        return res.rows.map(row => row.phone_number);
    } finally {
        client.release();
    }
}
module.exports = {
    pool,
    ensureDbInitialized,
    saveConfigToDB,
    getConfigFromDB,
    getCustomTriggersFromDB,
    saveCustomTriggerToDB,
    deleteCustomTriggerFromDB,
    getAutopostSettings,
    saveAutopostSetting,
    deleteAutopost,
    connectdb,
    initializeSettings,
    input,
    get,
    getalls,
    resetSettings,
    getAllNumbersFromDB
};
