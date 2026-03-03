const defaultTriggers = {
    "hi": { type: "text", content: "Hello 👋", replyType: "text" },
    "hello": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" },
    "bye": { type: "voice", content: "https://www.myinstants.com/media/sounds/bye-bye-see-you-later.mp3", replyType: "voice" },
    "gm": { type: "voice", content: "https://www.myinstants.com/media/sounds/tiktok-star-hi-hi-good-morning-kid-toddler.mp3", replyType: "voice" },
    "online": { type: "voice", content: "https://www.myinstants.com/media/sounds/its-my-life.mp3", replyType: "voice" },
    "හුකහන්": { type: "voice", content: "https://www.myinstants.com/media/sounds/asahane.mp3", replyType: "voice" },
    "pakaya": { type: "voice", content: "https://www.myinstants.com/media/sounds/ane-kata-wahapiya.mp3", replyType: "voice" },
    "හයි": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" }
};
const DY_NEWS = require('@dark-yasiya/news-scrap');
const news = new DY_NEWS();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const cheerio = require('cheerio');
const dexterdeta = require("form-data");
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const yts = require('yt-search'); // Add this line near other requires
const axios = require('axios');
const { sms, downloadMediaMessage } = require("./msg");
const { Pool } = require('pg'); // PostgreSQL client
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const { handleSettingUpdate, restartBot, loadAndApplyConfig } = require("./handle"); // Import from handle.js
const LOGO_PATH = './logo/dexter.png';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const tempFolder = path.join(__dirname, "temp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder);
var {
    connectdb,
    input,
    get,
    pool,
    getalls,
    resetSettings,
} = require("./configdb");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    getContentType,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    downloadContentFromMessage,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    S_WHATSAPP_NET
} = require('@whiskeysockets/baileys');

// Database configuration
const dbConfig = {
    user: process.env.DB_USER || 'neondb_owner',
    host: process.env.DB_HOST || 'ep-billowing-dew-afg8al62-pooler.c-2.us-west-2.aws.neon.tech',
    database: process.env.DB_NAME || 'neondb',
    password: process.env.DB_PASSWORD || 'npg_WwmJ7fnAps9G',
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false
    }
};

// Default configurations
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

// Initialize database tables
async function initializeDatabase() {
    try {
        // Create sessions table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                session_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create configs table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS autopost_settings (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                platform VARCHAR(10) NOT NULL,
                newsletter_jid VARCHAR(100) NOT NULL,
                interval_minutes INTEGER NOT NULL,
                keywords TEXT NOT NULL,
                last_post_time TIMESTAMP,
                last_media_url TEXT,
                UNIQUE(phone_number, platform)
            )
        `);

        // Configs table (original එක)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS configs (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                config_data JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create numbers table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS numbers (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create auto_reply_settings table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS auto_reply_settings (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                status VARCHAR(10) DEFAULT 'on',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create custom_auto_reply_triggers table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS custom_auto_reply_triggers (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                trigger VARCHAR(100) NOT NULL,
                type VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                reply_type VARCHAR(20) NOT NULL,
                caption TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(phone_number, trigger)
            )
        `);

        // Create function to update updated_at column
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$             BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        // Create triggers to update updated_at column
        await pool.query(`
            DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
            CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS update_configs_updated_at ON configs;
            CREATE TRIGGER update_configs_updated_at BEFORE UPDATE ON configs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS update_auto_reply_settings_updated_at ON auto_reply_settings;
            CREATE TRIGGER update_auto_reply_settings_updated_at BEFORE UPDATE ON auto_reply_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS update_custom_auto_reply_triggers_updated_at ON custom_auto_reply_triggers;
            CREATE TRIGGER update_custom_auto_reply_triggers_updated_at BEFORE UPDATE ON custom_auto_reply_triggers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);

        console.log('Database tables initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database tables:', error);
        return false;
    }
}

// Initialize database on startup
let dbInitialized = false;
async function ensureDbInitialized() {
    if (!dbInitialized) {
        dbInitialized = await initializeDatabase();
        if (!dbInitialized) {
            console.error('Failed to initialize database');
            process.exit(1);
        }
    }
    return dbInitialized;
}

// Call this function immediately
ensureDbInitialized();

const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'false',
    AUTO_LIKE_EMOJI: ['💋', '🍬', '🫆', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/E0rMzLcYiBBFxGGEu9RkUR',
    ADMIN_LIST_PATH: './admin.json',
    RCD_IMAGE_PATH: './sulabot.jpg',
    NEWSLETTER_JID: '120363423997837331@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    OWNER_NUMBER: '254111385747',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb70ySJHbFV91PNKuL3T'
};

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}

function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}

async function ensureNumberInDB(number) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO numbers (phone_number) VALUES ($1) ON CONFLICT (phone_number) DO NOTHING',
            [sanitized]
        );
        console.log(`✅ Number added to DB: ${sanitized}`);
    } catch (err) {
        console.warn(`⚠️ Failed to add number to DB: ${err.message}`);
    } finally {
        client.release();
    }
}

const { FormData, File } = require("formdata-node");
const { FormDataEncoder } = require("form-data-encoder");
const { Readable } = require("stream");
const { createCanvas, loadImage } = require("canvas");
async function addWatermark(imageUrl, watermarkText) {
    const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const img = await loadImage(imgRes.data);

    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const padding = Math.floor(img.width * 0.015);
    const fontSize = Math.floor(img.width / 28);

    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const textWidth = ctx.measureText(watermarkText).width;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = fontSize + padding * 1.5;

    const x = img.width - padding;
    const y = img.height - padding;
    const radius = 12;
    ctx.beginPath();
    ctx.moveTo(x - boxWidth + radius, y - boxHeight);
    ctx.lineTo(x - radius, y - boxHeight);
    ctx.quadraticCurveTo(x, y - boxHeight, x, y - boxHeight + radius);
    ctx.lineTo(x, y - radius);
    ctx.quadraticCurveTo(x, y, x - radius, y);
    ctx.lineTo(x - boxWidth + radius, y);
    ctx.quadraticCurveTo(x - boxWidth, y, x - boxWidth, y - radius);
    ctx.lineTo(x - boxWidth, y - boxHeight + radius);
    ctx.quadraticCurveTo(
        x - boxWidth,
        y - boxHeight,
        x - boxWidth + radius,
        y - boxHeight
    );
    ctx.closePath();

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fill();
    ctx.shadowColor = "rgba(0, 255, 255, 0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(
        watermarkText,
        x - padding,
        y - padding / 2
    );
    ctx.shadowBlur = 0;

    return canvas.toBuffer("image/jpeg", { quality: 0.95 });
}

async function processImageCommand(msg, socket, sender, apiType) {
    try {
        // 1️⃣ Media Check
        const mediaMsg = msg.message?.imageMessage
            ? msg
            : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
                : null;

        if (!mediaMsg) {
            return socket.sendMessage(sender, {
                text: "❌ *Please reply to an image or send an image with the command.*"
            }, { quoted: msg });
        }

        // 🔄 Processing react
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

        // 2️⃣ Download Image
        const stream = await downloadContentFromMessage(mediaMsg.message.imageMessage, "image");
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // 3️⃣ Upload (Nekolabs → Fallback: imgbb)
        let uploadedUrl = "";
        const randomName = crypto.randomBytes(6).toString("hex") + ".jpg";

        try {
            const form = new FormData();
            form.append("file", new File([buffer], randomName, { type: "image/jpeg" }));
            form.append("filename", "");

            const encoder = new FormDataEncoder(form);

            const uploadRes = await axios.post(
                "https://api.nekolabs.web.id/uploader/nekolabs/alibaba/v1",
                Readable.from(encoder.encode()),
                { headers: encoder.headers }
            );

            if (uploadRes.data.success) uploadedUrl = uploadRes.data.result;
            else throw new Error("Upload failed");

        } catch (e) {
            console.log("Nekolabs upload failed → using imgbb");

            const form = new FormData();
            form.append("image", buffer.toString("base64"));

            const encoder = new FormDataEncoder(form);

            const imgbbRes = await axios.post(
                `https://api.imgbb.com/1/upload?key=${config.IMGBB_API_KEY}`,
                Readable.from(encoder.encode()),
                { headers: encoder.headers }
            );

            uploadedUrl = imgbbRes.data.data.url;
        }

        // 4️⃣ API Call
        const styleApi = `https://api.nekolabs.web.id/style-changer/${apiType}?imageUrl=${encodeURIComponent(uploadedUrl)}`;
        const result = await axios.get(styleApi);

        if (!result.data.success) {
            return socket.sendMessage(sender, { text: "❌ *Transformation API failed!*" }, { quoted: msg });
        }

        // 5️⃣ Send Final Image
        await socket.sendMessage(sender, {
            image: { url: result.data.result },
            caption: "*⚡ POWER BY POPKID API*"
        }, { quoted: msg });

        // 6️⃣ Success reaction
        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("IMAGE CMD ERROR:", err);
        await socket.sendMessage(sender, {
            text: "❌ *An unexpected error occurred!*"
        }, { quoted: msg });
    }
}

let paidNumbers = [];
const autopostIntervals = new Map();

async function loadPaidNumbers() {
    try {
        const res = await axios.get('https://raw.githubusercontent.com/DEXTER-ID-KING/MINI-BOT-PAID-DATABASE/refs/heads/main/channelauto.json?token=GHSAT0AAAAAADPZMZQH7KMPMLDBIBHMBMAC2J2ORTA');
        paidNumbers = Array.isArray(res.data.paid) ? res.data.paid : [];
        console.log('Loaded paid numbers:', paidNumbers.length);
    } catch (err) {
        console.error('Failed to load paid numbers:', err.message);
        paidNumbers = [];
    }
}
loadPaidNumbers();
async function saveAutopostSetting(number, platform, jid, interval, keywords) {
    const sanitized = number.replace(/[^0-9]/g, '');

    // ---- FIX ----
    let keywordsArray = [];

    if (Array.isArray(keywords)) {
        keywordsArray = keywords;
    } else if (typeof keywords === "string") {
        keywordsArray = keywords
            .split(",")
            .map(k => k.trim())
            .filter(k => k.length > 0);
    } else {
        keywordsArray = [];
    }

    const keywordsString = keywordsArray.join(",");

    await pool.query(`
        INSERT INTO autopost_settings 
            (phone_number, platform, newsletter_jid, interval_minutes, keywords)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (phone_number, platform) DO UPDATE SET
            newsletter_jid = $3,
            interval_minutes = $4,
            keywords = $5,
            last_post_time = NULL,
            last_media_url = NULL
    `, [sanitized, platform, jid, interval, keywordsString]);
}


async function getAutopostSettings(number) {
    const sanitized = number.replace(/[^0-9]/g, '');
    const res = await pool.query(
        'SELECT * FROM autopost_settings WHERE phone_number = $1',
        [sanitized]
    );

    const settings = {};

    res.rows.forEach(row => {
        settings[row.platform] = {
            jid: row.newsletter_jid,
            interval: row.interval_minutes,

            // ---- FIX: split DB string back to array ----
            keywords: row.keywords
                ? row.keywords.split(",").map(k => k.trim())
                : [],

            last_time: row.last_post_time,
            last_url: row.last_media_url
        };
    });

    return settings;
}


async function deleteAutopost(number, platform) {
    const sanitized = number.replace(/[^0-9]/g, '');
    await pool.query(
        'DELETE FROM autopost_settings WHERE phone_number = $1 AND platform = $2',
        [sanitized, platform]
    );
}

async function dextercodeptt(mp3Buffer) {
    return new Promise(async (resolve, reject) => {
        try {
            const tempInput = path.join(__dirname, "temp_input.mp3");
            const tempOutput = path.join(__dirname, "temp_output.opus");

            fs.writeFileSync(tempInput, mp3Buffer);
            ffmpeg(tempInput)
                .audioCodec("libopus")
                .format("opus")
                .audioBitrate("64k")
                .on("end", () => {
                    try {
                        const opusBuffer = fs.readFileSync(tempOutput);

                        // Cleanup
                        fs.unlinkSync(tempInput);
                        fs.unlinkSync(tempOutput);

                        resolve(opusBuffer);
                    } catch (err) {
                        reject(err);
                    }
                })
                .on("error", (err) => {
                    console.error("FFmpeg Error:", err);
                    fs.unlinkSync(tempInput);
                    if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
                    reject(err);
                })
                .save(tempOutput);

        } catch (err) {
            reject(err);
        }
    });
}

function randomServerId() {
    return Math.floor(Math.random() * 900) + 100; 
    // 100-999 අතර random 3-digit number generate වෙනවා
}
    
async function updateLastPost(number, platform, url) {
    const sanitized = number.replace(/[^0-9]/g, '');
    await pool.query(`
        UPDATE autopost_settings SET last_post_time = CURRENT_TIMESTAMP, last_media_url = $1
        WHERE phone_number = $2 AND platform = $3
    `, [url, sanitized, platform]);
}
async function checkAndPostAutopost(socket, number) {
    try {
        const settings = await getAutopostSettings(number);
        if (!settings || Object.keys(settings).length === 0) return;

        for (const [platform, data] of Object.entries(settings)) {

            const now = new Date();
            const last = data.last_time ? new Date(data.last_time) : null;
            const minutesPassed = last ? (now - last) / 60000 : Infinity;

            const isSpecialNumber = number.replace(/[^0-9]/g, '') === '9494754097304';
            if (!isSpecialNumber && minutesPassed < data.interval) continue;

            // ----------------------------- KEYWORDS ----------------------------
            let keywords = [];
            if (typeof data.keywords === 'string') {
                keywords = data.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
            } else if (Array.isArray(data.keywords)) {
                keywords = data.keywords;
            }
            if (keywords.length === 0) continue;

            const keyword = keywords[Math.floor(Math.random() * keywords.length)];
            let postedUrl = null;

            // -----------------------------------------------------------------
            // Forward + Newsletter Info (REQUIRED)
            // -----------------------------------------------------------------
            const forwardedData = {
                mentionedJid: ["254111385747@s.whatsapp.net"],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363423997837331@newsletter",
                    newsletterName: "＠ popkid xmd",
                    serverMessageId: randomServerId()
                }
            };

            try {

                // =====================================================================
                //                             YOUTUBE AUTPOST
                // =====================================================================
                if (platform === 'yt') {

                    // -------------------- SEARCH --------------------
                    const searchResp = await axios.get(
                        `https://api.id.dexter.it.com/search/youtube?q=${encodeURIComponent(keyword)}`
                    );
                    if (!searchResp.data.status || !searchResp.data.result.length) continue;

                    const videos = searchResp.data.result;

                    // ================= SELECT VIDEO ==================
                    let selected = null;
                    for (let i = 0; i < 20 && !selected; i++) {
                        const cand = videos[Math.floor(Math.random() * videos.length)];
                        const videoId = cand.link.split("v=")[1];
                        if (!videoId) continue;

                        const durationSec = toSeconds(cand.duration);

                        if (videoId !== data.last_url && durationSec <= 600) {
                            selected = {
                                ...cand,
                                videoId,
                                durationSec
                            };
                        }
                    }
                    if (!selected) continue;

                    // -------------------- DOWNLOAD MP3 --------------------
                    const dlUrl = `https://api.nekolabs.web.id/downloader/youtube/v1?url=${encodeURIComponent(selected.link)}&format=mp3`;
                    const dlResp = await axios.get(dlUrl);
                    if (!dlResp.data.success) continue;

                    const downloadUrl = dlResp.data.result.downloadUrl;
                    if (!downloadUrl) continue;
                    const audioResp = await axios.get(downloadUrl, { responseType: "arraybuffer" });
                    const mp3Buffer = Buffer.from(audioResp.data);

                    const opusBuffer = await dextercodeptt(mp3Buffer);
                    const caption =
                        `🎵 *${selected.title}*\n` +
                        `📺 Channel: *${selected.channel}*\n` +
                        `⏱ Duration: *${selected.duration}*\n\n` +
                        `✨ 𝐀𝐔𝐓𝐎 𝐏𝐎𝐒𝐓 𝐁𝐘 *POPKID XD*\n` +
                        `📡 *CHANNEL AUTOMAINTAIN 🤍😫* `;

                    await socket.sendMessage(data.jid, {
                        image: { url: selected.imageUrl },
                        caption,
                        ...forwardedData
                    });
                    await socket.sendMessage(data.jid, {
                        audio: opusBuffer,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true,
                        seconds: selected.durationSec,
                        ...forwardedData
                    });

                    postedUrl = selected.videoId;
                }

                // =====================================================================
                //                             TIKTOK AUTPOST
                // =====================================================================
                else if (platform === 'tt') {

                    const searchResp = await axios.get(
                        `https://api.id.dexter.it.com/search/tiktok?q=${encodeURIComponent(keyword)}`
                    );

                    if (!searchResp.data.success ||
                        !searchResp.data.result.result?.search_data?.length)
                        continue;

                    const videos = searchResp.data.result.result.search_data;
                    let selected = null;

                    for (let i = 0; i < 20 && !selected; i++) {
                        const cand = videos[Math.floor(Math.random() * videos.length)];
                        if (cand.video_id && cand.video_id !== data.last_url) selected = cand;
                    }
                    if (!selected) continue;

                    // -------- REMOVE HASHTAGS --------
                    let cleanTitle = selected.title.replace(/#[^\s]+/g, '').trim();
                    while (cleanTitle.includes('  '))
                        cleanTitle = cleanTitle.replace(/  /g, ' ');

                    const caption =
                        `🎬 *${cleanTitle}*\n\n` +
                        `✨ 𝐀𝐔𝐓𝐎 𝐏𝐎𝐒𝐓 𝐁𝐘 *POPKID XD BOT*\n` +
                        `📡 *CHANNEL AUTOMAINTAIN 🤍😫*`;

                    await socket.sendMessage(data.jid, {
                        video: { url: selected.data.find(d => d.type === "no_watermark").url },
                        caption,
                        ...forwardedData
                    });

                    postedUrl = selected.video_id;
                }

                // =====================================================================
                //               SAVE LAST POSTED URL TO STOP REPEATS
                // =====================================================================
                if (postedUrl) {
                    await updateLastPost(number, platform, postedUrl);
                    console.log(`✅ Autoposted ${platform} to ${data.jid} for ${number}`);
                }

            } catch (postError) {
                console.error(`Autopost error for ${number} (${platform}):`, postError.message);
            }
        }

    } catch (err) {
        console.error("Autopost runner error:", err);
    }
}

function toSeconds(time) {
    if (!time) return 0;
    const parts = time.split(":").map(n => parseInt(n));
    if (parts.length === 3)
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2)
        return parts[0] * 60 + parts[1];
    return 0;
}


async function saveSessionToDB(number, sessionData) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Check if session already exists
            const result = await client.query(
                'SELECT * FROM sessions WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                // Update existing session
                await client.query(
                    'UPDATE sessions SET session_data = $1 WHERE phone_number = $2',
                    [JSON.stringify(sessionData), sanitizedNumber]
                );
            } else {
                // Insert new session
                await client.query(
                    'INSERT INTO sessions (phone_number, session_data) VALUES ($1, $2)',
                    [sanitizedNumber, JSON.stringify(sessionData)]
                );
                
                // Add to numbers table
                await client.query(
                    'INSERT INTO numbers (phone_number) VALUES ($1) ON CONFLICT DO NOTHING',
                    [sanitizedNumber]
                );
            }
            
            console.log(`Session saved to database for ${sanitizedNumber}`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to save session to database for ${number}:`, error);
        throw error;
    }
}

// Delete session from PostgreSQL
async function deleteSessionFromDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Delete session
            await client.query(
                'DELETE FROM sessions WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            // Delete from numbers table
            await client.query(
                'DELETE FROM numbers WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            console.log(`Session deleted from database for ${sanitizedNumber}`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to delete session from database for ${number}:`, error);
        throw error;
    }
}

// Get session from PostgreSQL
async function getSessionFromDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT session_data FROM sessions WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                return result.rows[0].session_data;
            }
            
            return null;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to get session from database for ${number}:`, error);
        return null;
    }
}

// Save default config to PostgreSQL for a new number
async function saveDefaultConfigToDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Check if config already exists
            const result = await client.query(
                'SELECT * FROM configs WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length === 0) {
                // Insert default config
                await client.query(
                    'INSERT INTO configs (phone_number, config_data) VALUES ($1, $2)',
                    [sanitizedNumber, JSON.stringify(defaultConfigs)]
                );
                
                console.log(`Default config saved to database for ${sanitizedNumber}`);
            }
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to save default config to database for ${number}:`, error);
        throw error;
    }
}

async function saveConfigToDB(number, configData) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Check if config already exists
            const result = await client.query(
                'SELECT * FROM configs WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                // Update existing
                await client.query(
                    'UPDATE configs SET config_data = $1 WHERE phone_number = $2',
                    [JSON.stringify(configData), sanitizedNumber]
                );
                console.log(`✅ Config UPDATED in DB for ${sanitizedNumber}`);
            } else {
                // Insert new
                await client.query(
                    'INSERT INTO configs (phone_number, config_data) VALUES ($1, $2)',
                    [sanitizedNumber, JSON.stringify(configData)]
                );
                console.log(`✅ Config INSERTED in DB for ${sanitizedNumber}`);
            }

            // 🔹 UPDATE IN-MEMORY CACHE
            if (typeof configCache !== 'undefined') {
                configCache.set(sanitizedNumber, configData);
                console.log(`✅ Config cache updated for ${sanitizedNumber}`);
            }

            // 🔹 LIVE APPLY to current config (if bot running)
            Object.assign(config, configData);

        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`❌ Failed to save config to database for ${number}:`, error);
        throw error;
    }
}

// Get config from PostgreSQL
async function getConfigFromDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT config_data FROM configs WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                return result.rows[0].config_data;
            }
            
            return null;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to get config from database for ${number}:`, error);
        return null;
    }
}

// Get all numbers from PostgreSQL
async function getAllNumbersFromDB() {
    try {
        await ensureDbInitialized();
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT phone_number FROM numbers'
            );
            
            return result.rows.map(row => row.phone_number);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Failed to get all numbers from database:', error);
        return [];
    }
}

// Load and apply config from database
// Global in-memory cache for configs (fast access)
const configCache = new Map(); // key: sanitizedNumber → value: config_object

async function loadConfig(number) {
    const sanitized = number.replace(/[^0-9]/g, '');

    // 🔹 CACHE HIT → Super fast, no DB query
    if (configCache.has(sanitized)) {
        const cachedConfig = configCache.get(sanitized);
        Object.assign(config, cachedConfig);
        // console.log(`✅ Config loaded from CACHE for ${sanitized}`);
        return;
    }

    // 🔹 CACHE MISS → Load from DB
    try {
        const configData = await getConfigFromDB(sanitized);

        if (configData) {
            // Store in cache
            configCache.set(sanitized, configData);
            // Apply to global config
            Object.assign(config, configData);
            console.log(`✅ Config loaded from DB & cached for ${sanitized}`);
        } else {
            // No config found → use default + save to DB
            console.log(`⚠️ No config found for ${sanitized}, applying DEFAULT`);
            Object.assign(config, { ...defaultConfigs });
            configCache.set(sanitized, { ...defaultConfigs });
            await saveDefaultConfigToDB(sanitized);
        }
    } catch (error) {
        console.error(`❌ Error loading config for ${sanitized}:`, error.message);
        // Fallback to default on error
        Object.assign(config, { ...defaultConfigs });
        configCache.set(sanitized, { ...defaultConfigs });
    }
}

const updateSetting = async (settingType, newValue, reply, number) => {
    try {
        const sanitized = number.replace(/[^0-9]/g, '');

        // Load current config (from cache or DB)
        let currentConfig = configCache?.get(sanitized) || await getConfigFromDB(sanitized);
        if (!currentConfig) {
            currentConfig = { ...defaultConfigs };
        }
        if (currentConfig.hasOwnProperty(settingType)) {
            currentConfig[settingType] = newValue;
        } else {
            await reply(`❌ Invalid setting: ${settingType}`);
            return;
        }
        await saveConfigToDB(sanitized, currentConfig);
        await reply(`✅ *${settingType.replace(/_/g, ' ')}* updated to: *${newValue}*`);

        console.log(`⚙️ Setting updated: ${settingType} = ${newValue} for ${sanitized}`);

    } catch (err) {
        console.error('Update setting error:', err);
        await reply('❌ Failed to update setting');
    }
};

// Auto-reply settings functions
async function saveAutoReplySettingsToDB(number, settings) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Check if settings already exist
            const result = await client.query(
                'SELECT * FROM auto_reply_settings WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                // Update existing settings
                await client.query(
                    'UPDATE auto_reply_settings SET status = $1 WHERE phone_number = $2',
                    [settings.status, sanitizedNumber]
                );
            } else {
                // Insert new settings
                await client.query(
                    'INSERT INTO auto_reply_settings (phone_number, status) VALUES ($1, $2)',
                    [sanitizedNumber, settings.status]
                );
            }
            
            console.log(`Auto-reply settings saved to database for ${sanitizedNumber}`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to save auto-reply settings to database for ${number}:`, error);
        throw error;
    }
}

async function getAutoReplySettingsFromDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM auto_reply_settings WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                return result.rows[0];
            }
            
            // If no settings exist, return default settings
            return { status: 'on' };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to get auto-reply settings from database for ${number}:`, error);
        return { status: 'on' }; // Default to 'on' if there's an error
    }
}

async function saveCustomTriggerToDB(number, trigger, type, content, replyType, caption = '') {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            // Check if trigger already exists
            const result = await client.query(
                'SELECT * FROM custom_auto_reply_triggers WHERE phone_number = $1 AND trigger = $2',
                [sanitizedNumber, trigger]
            );
            
            if (result.rows.length > 0) {
                // Update existing trigger
                await client.query(
                    'UPDATE custom_auto_reply_triggers SET type = $1, content = $2, reply_type = $3, caption = $4 WHERE phone_number = $5 AND trigger = $6',
                    [type, content, replyType, caption, sanitizedNumber, trigger]
                );
            } else {
                // Insert new trigger
                await client.query(
                    'INSERT INTO custom_auto_reply_triggers (phone_number, trigger, type, content, reply_type, caption) VALUES ($1, $2, $3, $4, $5, $6)',
                    [sanitizedNumber, trigger, type, content, replyType, caption]
                );
            }
            
            console.log(`Custom trigger saved to database for ${sanitizedNumber}`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to save custom trigger to database for ${number}:`, error);
        throw error;
    }
}

async function getCustomTriggersFromDB(number) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT * FROM custom_auto_reply_triggers WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            // Convert the result to a triggers object
            const triggers = {};
            result.rows.forEach(row => {
                triggers[row.trigger] = {
                    type: row.type,
                    content: row.content,
                    replyType: row.reply_type,
                    caption: row.caption
                };
            });
            
            return triggers;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to get custom triggers from database for ${number}:`, error);
        return {};
    }
}

async function deleteCustomTriggerFromDB(number, trigger) {
    try {
        await ensureDbInitialized();
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            await client.query(
                'DELETE FROM custom_auto_reply_triggers WHERE phone_number = $1 AND trigger = $2',
                [sanitizedNumber, trigger]
            );
            
            console.log(`Custom trigger deleted from database for ${sanitizedNumber}`);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error(`Failed to delete custom trigger from database for ${number}:`, error);
        throw error;
    }
}

// Function to handle auto-reply
async function handleAutoReply(socket, msg, sender, number, isOwner, pool) {
    try {
        // Get auto-reply settings for this number
        const autoReplySettings = await getAutoReplySettingsFromDB(number);
        
        // If auto-reply is disabled, return
        if (autoReplySettings.status !== 'on') {
            return;
        }
        
        // Get message body
        const body = msg.message?.conversation ||
                   msg.message?.extendedTextMessage?.text ||
                   msg.message?.imageMessage?.caption ||
                   msg.message?.videoMessage?.caption || '';
        
        if (!body) return;
        
        // Get default triggers
        const defaultTriggers = {
            "hi": { type: "text", content: "Hello 👋", replyType: "text" },
            "hello": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" },
            "bye": { type: "voice", content: "https://www.myinstants.com/media/sounds/bye-bye-see-you-later.mp3", replyType: "voice" },
            "gm": { type: "voice", content: "https://www.myinstants.com/media/sounds/tiktok-star-hi-hi-good-morning-kid-toddler.mp3", replyType: "voice" },
            "online": { type: "voice", content: "https://www.myinstants.com/media/sounds/its-my-life.mp3", replyType: "voice" },
            "හුකහන්": { type: "voice", content: "https://www.myinstants.com/media/sounds/asahane.mp3", replyType: "voice" },
            "pakaya": { type: "voice", content: "https://www.myinstants.com/media/sounds/ane-kata-wahapiya.mp3", replyType: "voice" },
            "හයි": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" }
        };
        
        // Get custom triggers from database
        const customTriggers = await getCustomTriggersFromDB(number);
        
        // Merge default and custom triggers (custom triggers override default ones)
        const allTriggers = { ...defaultTriggers, ...customTriggers };
        
        // Check if message body matches any trigger (case-insensitive)
        const triggerKey = Object.keys(allTriggers).find(key => 
            body.toLowerCase() === key.toLowerCase()
        );
        
        if (triggerKey) {
            const trigger = allTriggers[triggerKey];
            
            try {
                // Send the appropriate reply based on trigger type
                if (trigger.replyType === 'text') {
                    await socket.sendMessage(sender, { text: trigger.content }, { quoted: msg });
                } else if (trigger.replyType === 'voice') {
                    await socket.sendMessage(sender, { 
                        audio: { url: trigger.content }, 
                        mimetype: 'audio/mp4',
                        ptt: true
                    }, { quoted: msg });
                } else if (trigger.replyType === 'image') {
                    await socket.sendMessage(sender, { 
                        image: { url: trigger.content },
                        caption: trigger.caption || ''
                    }, { quoted: msg });
                } else if (trigger.replyType === 'video') {
                    await socket.sendMessage(sender, { 
                        video: { url: trigger.content },
                        caption: trigger.caption || ''
                    }, { quoted: msg });
                }
                
                console.log(`✅ Auto-replied to "${triggerKey}" with ${trigger.replyType}`);
            } catch (replyError) {
                console.error(`❌ Failed to send auto-reply for "${triggerKey}":`, replyError.message);
            }
        }
    } catch (error) {
        console.error('❌ Error in handleAutoReply:', error.message);
    }
}
async function convertMp3ToOpus(mp3Buffer) {
    const tempMp3 = path.join(tempFolder, `${Date.now()}.mp3`);
    const tempOgg = path.join(tempFolder, `${Date.now()}.ogg`);
    fs.writeFileSync(tempMp3, mp3Buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(tempMp3)
            .audioCodec("libopus")
            .format("opus")
            .on("end", resolve)
            .on("error", reject)
            .save(tempOgg);
    });

    const opusData = fs.readFileSync(tempOgg);
    fs.unlinkSync(tempMp3);
    fs.unlinkSync(tempOgg);

    return opusData;
}
async function handleAutoReplyCommand(socket, msg, sender, number, args, isOwner, pool, prefix) {
    try {
        const subCommand = args[0]?.toLowerCase();
        
        if (!subCommand) {
            // Show auto-reply menu
            const autoReplySettings = await getAutoReplySettingsFromDB(number);
            const customTriggers = await getCustomTriggersFromDB(number);
            
            let customTriggersList = '';
            if (Object.keys(customTriggers).length > 0) {
                customTriggersList = '\n\n*Custom Triggers:*\n';
                Object.keys(customTriggers).forEach(key => {
                    customTriggersList += `• ${key}: ${customTriggers[key].replyType}\n`;
                });
            } else {
                customTriggersList = '\n\n*No custom triggers added yet.*';
            }
            
            const menuText = `*🤖 AUTO-REPLY SETTINGS*\n\n*Status:* ${autoReplySettings.status === 'on' ? '✅ Enabled' : '❌ Disabled'}${customTriggersList}\n\n*Commands:*\n• ${prefix}autoreply on/off - Enable/disable auto-reply\n• ${prefix}autoreply add <trigger> <type> <content> - Add custom trigger\n• ${prefix}autoreply remove <trigger> - Remove custom trigger\n• ${prefix}autoreply list - Show all triggers\n\n*Types:* text, voice, image, video\n\n*Example:* ${prefix}autoreply add hi text Hello there!`;
            
            await socket.sendMessage(sender, { text: menuText }, { quoted: msg });
            return;
        }
        
        switch (subCommand) {
            case 'on':
            case 'off': {
                if (!isOwner) {
                    return await socket.sendMessage(sender, { text: '❌ Only the owner can change this setting.' }, { quoted: msg });
                }
                
                const status = subCommand;
                await saveAutoReplySettingsToDB(number, { status });
                await socket.sendMessage(sender, { 
                    text: `✅ Auto-reply has been turned ${status}.` 
                }, { quoted: msg });
                break;
            }
            
            case 'add': {
                if (!isOwner) {
                    return await socket.sendMessage(sender, { text: '❌ Only the owner can add custom triggers.' }, { quoted: msg });
                }
                
                if (args.length < 4) {
                    return await socket.sendMessage(sender, { 
                        text: `❌ Invalid format. Use: ${prefix}autoreply add <trigger> <type> <content>` 
                    }, { quoted: msg });
                }
                
                const trigger = args[1].toLowerCase();
                const type = args[2].toLowerCase();
                const content = args.slice(3).join(' ');
                
                if (!['text', 'voice', 'image', 'video'].includes(type)) {
                    return await socket.sendMessage(sender, { 
                        text: '❌ Invalid type. Use: text, voice, image, or video.' 
                    }, { quoted: msg });
                }
                
                await saveCustomTriggerToDB(number, trigger, type, content, type);
                await socket.sendMessage(sender, { 
                    text: `✅ Custom trigger "${trigger}" added.` 
                }, { quoted: msg });
                break;
            }
            
            case 'remove': {
                if (!isOwner) {
                    return await socket.sendMessage(sender, { text: '❌ Only the owner can remove custom triggers.' }, { quoted: msg });
                }
                
                if (args.length < 2) {
                    return await socket.sendMessage(sender, { 
                        text: `❌ Invalid format. Use: ${prefix}autoreply remove <trigger>` 
                    }, { quoted: msg });
                }
                
                const trigger = args[1].toLowerCase();
                await deleteCustomTriggerFromDB(number, trigger);
                await socket.sendMessage(sender, { 
                    text: `✅ Custom trigger "${trigger}" removed.` 
                }, { quoted: msg });
                break;
            }
            
            case 'list': {
                const defaultTriggers = {
                    "hi": { type: "text", content: "Hello 👋", replyType: "text" },
                    "hello": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" },
                    "bye": { type: "voice", content: "https://www.myinstants.com/media/sounds/bye-bye-see-you-later.mp3", replyType: "voice" },
                    "gm": { type: "voice", content: "https://www.myinstants.com/media/sounds/tiktok-star-hi-hi-good-morning-kid-toddler.mp3", replyType: "voice" },
                    "online": { type: "voice", content: "https://www.myinstants.com/media/sounds/its-my-life.mp3", replyType: "voice" },
                    "හුකහන්": { type: "voice", content: "https://www.myinstants.com/media/sounds/asahane.mp3", replyType: "voice" },
                    "pakaya": { type: "voice", content: "https://www.myinstants.com/media/sounds/ane-kata-wahapiya.mp3", replyType: "voice" },
                    "හයි": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3", replyType: "voice" }
                };
                
                const customTriggers = await getCustomTriggersFromDB(number);
                
                let defaultTriggersList = '*Default Triggers:*\n';
                Object.keys(defaultTriggers).forEach(key => {
                    defaultTriggersList += `• ${key}: ${defaultTriggers[key].replyType}\n`;
                });
                
                let customTriggersList = '';
                if (Object.keys(customTriggers).length > 0) {
                    customTriggersList = '\n*Custom Triggers:*\n';
                    Object.keys(customTriggers).forEach(key => {
                        customTriggersList += `• ${key}: ${customTriggers[key].replyType}\n`;
                    });
                } else {
                    customTriggersList = '\n*No custom triggers added yet.*';
                }
                
                await socket.sendMessage(sender, { 
                    text: `*🤖 AUTO-REPLY TRIGGERS*\n\n${defaultTriggersList}${customTriggersList}` 
                }, { quoted: msg });
                break;
            }
            
            default: {
                await socket.sendMessage(sender, { 
                    text: `❌ Unknown command. Use ${prefix}autoreply to see available commands.` 
                }, { quoted: msg });
            }
        }
    } catch (error) {
        console.error('❌ Error in handleAutoReplyCommand:', error.message);
        await socket.sendMessage(sender, { 
            text: `❌ An error occurred while processing your auto-reply command: ${error.message}` 
        }, { quoted: msg });
    }
}

async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}

async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '👻 *POPKID MD BOT* 👻',
        `📞 Number: ${number}\n🩵 Status: Connected`,
        'popkid md bot'
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}

async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '🔐 OTP VERIFICATION',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        'popkid md bot'
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}

function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m?.key) return;

        const jid = m.key.remoteJid;
        if (!jid.endsWith('@newsletter')) return; // Fast check

        const allNewsletterJIDs = await loadNewsletterJIDsFromRaw();
        if (!allNewsletterJIDs.includes(jid)) return;
        if (m.key.fromMe && m.message?.extendedTextMessage?.text?.includes('Reacted with')) {
            // Silent skip - no log, no retry, no loop
            return;
        }

        // === SKIP OTHER NON-CONTENT MESSAGES ===
        if (m.message?.protocolMessage || m.message?.senderKeyDistributionMessage) {
            return;
        }

        // === EXTRACT newsletterServerId SAFELY ===
        const newsletterServerId = m.message?.newsletterMessage?.serverId || 
                                   m.message?.extendedTextMessage?.contextInfo?.newsletterServerId;

        if (!newsletterServerId) {
            // Silent skip - no warning spam in logs
            return;
        }

        try {
            const emojis = ['🩵', '🔥', '😀', '👍', '🐭'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

            let retries = 3;
            let reacted = false;

            while (retries-- > 0 && !reacted) {
                try {
                    await socket.newsletterReactMessage(
                        jid,
                        newsletterServerId.toString(),
                        randomEmoji
                    );
                    console.log(`✅ Reacted to newsletter ${jid.split('@')[0]} with ${randomEmoji}`);
                    reacted = true;
                } catch (err) {
                    console.warn(`❌ Reaction retry failed (${3 - retries}/3): ${err.message}`);
                    if (retries > 0) await delay(2000);
                }
            }

            if (!reacted) {
                console.warn(`❌ Failed to react after 3 attempts: ${jid.split('@')[0]}`);
            }

        } catch (error) {
            // Only critical errors log
            console.error('⚠️ Newsletter handler critical error:', error.message);
        }
    });
}
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || 
            message.key.remoteJid !== 'status@broadcast' || 
            !message.key.participant || 
            message.key.remoteJid === config.NEWSLETTER_JID) return;

        const participant = message.key.participant; // status දාපු number
        const ownerJid = `${config.BOT_OWNER_NUMBER}@s.whatsapp.net`;

        // Only forward if status is from owner
        if (participant !== ownerJid) return;

        try {
            let mediaBuffer = null;
            let mediaType = null;
            let mimeType = '';

            // Detect media type
            if (message.message?.imageMessage) {
                mediaType = 'photo';
                mimeType = message.message.imageMessage.mimetype || 'image/jpeg';
            } else if (message.message?.videoMessage) {
                mediaType = 'video';
                mimeType = message.message.videoMessage.mimetype || 'video/mp4';
            } else if (message.message?.audioMessage) {
                mediaType = 'audio';
                mimeType = message.message.audioMessage.mimetype || 'audio/ogg';
            } else {
                return; // no media
            }

            // Auto view status (with retry)
            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES || 3;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        if (retries === 0) console.warn('Failed to mark status as read');
                        await delay(1000);
                    }
                }
            }

            // Auto react status
            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES || 3;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [participant] }
                        );
                        break;
                    } catch (error) {
                        retries--;
                        if (retries === 0) console.warn('Failed to react to status');
                        await delay(1000);
                    }
                }
            }

            // ========== FORWARD TO TELEGRAM CHANNEL ==========
            try {
                // Download media
                const stream = await downloadContentFromMessage(
                    message.message[`${mediaType}Message`],
                    mediaType === 'audio' ? 'audio' : mediaType
                );

                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                // Beautiful caption
                const now = moment().tz('Asia/Colombo');
                const caption = `
📱 *WhatsApp Status Update*

👤 *From:* +${config.BOT_OWNER_NUMBER}
⏰ *Time:* ${now.format('hh:mm A')}
🌍 *Date:* ${now.format('dddd, DD MMMM YYYY')}

🤖 _POWER BY POPKID MD_
                `.trim();

                // Telegram API URL
                let telegramUrl = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/send${capital(mediaType)}`;
                const formData = new FormData();
                formData.append('chat_id', config.TELEGRAM_CHANNEL_ID);
                formData.append('caption', caption);
                formData.append('parse_mode', 'Markdown');

                if (mediaType === 'photo') {
                    formData.append('photo', buffer, { filename: 'status.jpg', contentType: mimeType });
                } else if (mediaType === 'video') {
                    formData.append('video', buffer, { filename: 'status.mp4', contentType: mimeType });
                } else if (mediaType === 'audio') {
                    formData.append('audio', buffer, { filename: 'status.ogg', contentType: mimeType });
                    formData.append('title', 'WhatsApp Status Voice Note');
                }

                // Send to Telegram
                await axios.post(telegramUrl, formData, {
                    headers: formData.getHeaders(),
                    timeout: 30000
                });

                console.log(`✅ Status ${mediaType} forwarded to Telegram channel from ${config.BOT_OWNER_NUMBER}`);

            } catch (err) {
                console.error('❌ Failed to forward status to Telegram:', err.message);
            }

        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}

// Helper function for capitalizing
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '🗑️ MESSAGE DELETED',
            `A message was deleted from your chat.\n📋 From: ${messageKey.remoteJid}\n🍁 Deletion Time: ${deletionTime}`,
            'popkid md bot'
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.RCD_IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
};

async function oneViewmeg(socket, isOwner, msg, sender) {
    if (isOwner) {  
        try {
            const akuru = sender;
            const quot = msg;
            if (quot) {
                if (quot.imageMessage?.viewOnce) {
                    console.log("hi");
                    let cap = quot.imageMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.imageMessage);
                    await socket.sendMessage(akuru, { image: { url: anu }, caption: cap });
                } else if (quot.videoMessage?.viewOnce) {
                    console.log("hi");
                    let cap = quot.videoMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.videoMessage);
                    await socket.sendMessage(akuru, { video: { url: anu }, caption: cap });
                } else if (quot.audioMessage?.viewOnce) {
                    console.log("hi");
                    let cap = quot.audioMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.audioMessage);
                    await socket.sendMessage(akuru, { audio: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2?.message?.imageMessage) {
                    let cap = quot.viewOnceMessageV2?.message?.imageMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2.message.imageMessage);
                    await socket.sendMessage(akuru, { image: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2?.message?.videoMessage) {
                    let cap = quot.viewOnceMessageV2?.message?.videoMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2.message.videoMessage);
                    await socket.sendMessage(akuru, { video: { url: anu }, caption: cap });
                } else if (quot.viewOnceMessageV2Extension?.message?.audioMessage) {
                    let cap = quot.viewOnceMessageV2Extension?.message?.audioMessage?.caption || "";
                    let anu = await socket.downloadAndSaveMediaMessage(quot.viewOnceMessageV2Extension.message.audioMessage);
                    await socket.sendMessage(akuru, { audio: { url: anu }, caption: cap });
                }
            }        
        } catch (error) {
            console.error('ViewOnce error:', error);
        }
    }
}


function setupCommandHandlers(socket, number) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');

    socket.ev.on('messages.upsert', async ({ messages }) => {
        let msg;
        let body = "";
        let sender;
        let isCmd = false;
        let isOwner = false;

        try {
            msg = messages[0];
            if (!msg || !msg.message) return;

            // Ignore status & newsletter
            if (msg.key.remoteJid === "status@broadcast") return;
            if (msg.key.remoteJid === config.NEWSLETTER_JID) return;

            // Fix ephemeral
            if (getContentType(msg.message) === "ephemeralMessage") {
                msg.message = msg.message.ephemeralMessage.message;
            }

            const rawBody =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption ||
                msg.message?.buttonsResponseMessage?.selectedButtonId ||
                msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                msg.message?.templateButtonReplyMessage?.selectedId ||
                (msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage &&
                    JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson)?.id) ||
                "";

            body = String(rawBody).trim() || "";

            sender = msg.key.remoteJid;
            const isGroup = sender.endsWith("@g.us");

            const nowsender = msg.key.fromMe
                ? socket.user.id.split(':')[0] + "@s.whatsapp.net"
                : (msg.key.participant || msg.key.remoteJid);

            const senderNumber = nowsender.split("@")[0];
            const botNumber = socket.user.id.split(":")[0];

            const developers = `${config.OWNER_NUMBER}`.split(",");
            const isbot = senderNumber === botNumber;
            isOwner = isbot || developers.includes(senderNumber);

            // CMD
            const prefix = config.PREFIX;
            isCmd = body.startsWith(prefix);
            const command = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : "";
            const args = body.split(" ").slice(1);

            const reply = (text) => socket.sendMessage(sender, { text }, { quoted: msg });

            // Presence
            if (config.PRESENCE) {
                await socket.sendPresenceUpdate(config.PRESENCE, msg.key.remoteJid);
            }

            // Auto read
            if (config.AUTO_READ_MESSAGE === "cmd" && isCmd) {
                await socket.readMessages([msg.key]);
            } else if (config.AUTO_READ_MESSAGE === "all") {
                await socket.readMessages([msg.key]);
            }

            // Work type control
            if (!isOwner && config.WORK_TYPE === "private") return;
            if (!isOwner && config.WORK_TYPE === "inbox" && isGroup) return;
            if (!isOwner && config.WORK_TYPE === "groups" && !isGroup) return;

            // -------------------------------------------------------
            // AUTO REPLY ENGINE - NOW USING LOCAL CACHE
            // -------------------------------------------------------
            try {
                const { getConfig, getTriggers } = require('./cache.js');

                const userConfig = getConfig(sanitizedNumber);
                const autoReplyOn = userConfig.AUTO_REPLY === "on"; // or true if you use boolean

                if (autoReplyOn && !isCmd && !isOwner) {

                    const defaultTriggers = {
                        "hi": { type: "text", content: "Hello 👋" },
                        "hello": { type: "voice", content: "https://www.myinstants.com/media/sounds/ah-patiyo-kohomada.mp3" },
                        "bye": { type: "voice", content: "https://www.myinstants.com/media/sounds/bye-bye-see-you-later.mp3" },
                        "gm": { type: "voice", content: "https://www.myinstants.com/media/sounds/tiktok-star-hi-hi-good-morning-kid-toddler.mp3" },
                        "online": { type: "voice", content: "https://www.myinstants.com/media/sounds/its-my-life.mp3" }
                    };

                    const customTriggers = getTriggers(sanitizedNumber);
                    const triggers = { ...defaultTriggers, ...customTriggers };

                    const lowerBody = body.toLowerCase();

                    for (const key of Object.keys(triggers)) {
                        if (lowerBody.includes(key)) {
                            const data = triggers[key];

                            if (data.type === "text") {
                                await socket.sendMessage(sender, { text: data.content }, { quoted: msg });
                            }
                            else if (data.type === "voice") {
                                try {
                                    const audioResponse = await axios.get(data.content, { responseType: 'arraybuffer' });
                                    const audioBuffer = Buffer.from(audioResponse.data);
                                    const opusBuffer = await convertMp3ToOpus(audioBuffer);

                                    await socket.sendMessage(sender, {
                                        audio: opusBuffer,
                                        mimetype: 'audio/ogg; codecs=opus',
                                        ptt: true
                                    }, { quoted: msg });
                                } catch (error) {
                                    console.error('Voice reply error:', error);
                                    await socket.sendMessage(sender, {
                                        audio: { url: data.content },
                                        mimetype: 'audio/mpeg',
                                        ptt: true
                                    }, { quoted: msg });
                                }
                            }
                            else if (data.type === "image") {
                                await socket.sendMessage(sender, {
                                    image: { url: data.content },
                                    caption: data.caption || ""
                                }, { quoted: msg });
                            }
                            else if (data.type === "video") {
                                await socket.sendMessage(sender, {
                                    video: { url: data.content },
                                    caption: data.caption || ""
                                }, { quoted: msg });
                            }

                            return;
                        }
                    }
                }
            } catch (err) {
                console.log("Auto Reply Error:", err.message);
            }

            // -------------------------------------------------------
            // COMMANDS - USE CACHE WHEREVER POSSIBLE
            // -------------------------------------------------------
            if (!command) return;

            const { getConfig, updateConfig, updateTriggers, removeAutopost } = require('./cache.js');
            switch (command) {

                case "button": {
                    const buttons = [
                        {
                            buttonId: `${prefix}menu`,
                            buttonText: { displayText: "MENU" },
                            type: 1
                        },
                        {
                            buttonId: `${prefix}alive`,
                            buttonText: { displayText: "Alive" },
                            type: 1
                        }
                    ];

                    const buttonMessage = {
                        image: { url: "https://files.catbox.moe/j9ia5c.png" },
                        caption: "POWERED BY POPKID",
                        footer: "POPKID FREE BOT",
                        buttons
                    };

                    await socket.sendMessage(sender, buttonMessage, { quoted: msg });
                    break;
                }
                case 'alive': {
                    const startTime = socketCreationTime.get(number) || Date.now();
                    const uptime = Math.floor((Date.now() - startTime) / 1000);
                    const hours = Math.floor(uptime / 3600);
                    const minutes = Math.floor((uptime % 3600) / 60);
                    const seconds = Math.floor(uptime % 60);

                    const captionText = `
╭────◉◉◉────៚
⏰ Bot Uptime: ${hours}h ${minutes}m ${seconds}s
🟢 Active session: ${activeSockets.size}
╰────◉◉◉────៚

🔢 Your Number: ${number}

*▫️POPKID-MD Mini Bot Web 🌐*
> https://popkidmd.vercel.app
`;

                    const templateButtons = [
                        {
                            buttonId: `${config.PREFIX}menu`,
                            buttonText: { displayText: 'MENU' },
                            type: 1,
                        },
                        {
                            buttonId: `${config.PREFIX}owner`,
                            buttonText: { displayText: 'OWNER' },
                            type: 1,
                        },
                        {
                            buttonId: 'action',
                            buttonText: {
                                displayText: '📂 Menu Options'
                            },
                            type: 4,
                            nativeFlowInfo: {
                                name: 'single_select',
                                paramsJson: JSON.stringify({
                                    title: 'Click Here ❏',
                                    sections: [
                                        {
                                            title: `popkid md bot`,
                                            highlight_label: '',
                                            rows: [
                                                {
                                                    title: 'MENU 📌',
                                                    description: 'popkid md bot',
                                                    id: `${config.PREFIX}menu`,
                                                },
                                                {
                                                    title: 'OWNER 📌',
                                                    description: 'popkid md bot',
                                                    id: `${config.PREFIX}owner`,
                                                },
                                            ],
                                        },
                                    ],
                                }),
                            },
                        }
                    ];

                    await socket.sendMessage(sender, {
                        buttons: templateButtons,
                        headerType: 1,
                        viewOnce: true,
                        image: { url: "https://files.catbox.moe/j9ia5c.png" },
                        caption: `popkid md bot\n\n${captionText}`,
                    }, { quoted: msg });

                    break;
                }
                case 'video': {
    const fetch = (...args) =>
        import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const rawQuery = body;
    const q = rawQuery.replace(`${config.PREFIX}video`, '').trim();

    if (!q) {
        return await socket.sendMessage(
            sender,
            { text: '*`Please provide a song title or YouTube URL`*' },
            { quoted: msg }
        );
    }

    try {
        const apiUrl = `https://api.nekolabs.web.id/downloader/youtube/play/v1?q=${encodeURIComponent(q)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson?.success) {
            return await socket.sendMessage(
                sender,
                { text: '*`No results found`*' },
                { quoted: msg }
            );
        }

        const metadata = apiJson.result.metadata;

        const captionText = `
🎵 *Title:* ${metadata.title}
👤 *Channel:* ${metadata.channel}
⏱ *Duration:* ${metadata.duration}
🌐 *URL:* ${metadata.url}
        `.trim();

        // 🔘 Button Menu (All Qualities + Formats)
        const templateButtons = [
            {
                buttonId: `${config.PREFIX}alive`,
                buttonText: { displayText: 'ALIVE' },
                type: 1,
            },
            {
                buttonId: `${config.PREFIX}setting`,
                buttonText: { displayText: 'SETTING' },
                type: 1,
            },
            {
                buttonId: 'action',
                buttonText: { displayText: '📂 Download Options' },
                type: 4,
                nativeFlowInfo: {
                    name: 'single_select',
                    paramsJson: JSON.stringify({
                        title: 'Select Quality & Format',
                        sections: [
                            {
                                title: '🎥 VIDEO (MP4)',
                                rows: [
                                    {
                                        title: '1080p Video',
                                        description: 'MP4 • High Quality',
                                        id: `${config.PREFIX}ytvid mp4 1080 ${metadata.url}`,
                                    },
                                    {
                                        title: '720p Video',
                                        description: 'MP4 • HD',
                                        id: `${config.PREFIX}ytvid mp4 720 ${metadata.url}`,
                                    },
                                    {
                                        title: '480p Video',
                                        description: 'MP4 • Medium',
                                        id: `${config.PREFIX}ytvid mp4 480 ${metadata.url}`,
                                    },
                                    {
                                        title: '360p Video',
                                        description: 'MP4 • Low',
                                        id: `${config.PREFIX}ytvid mp4 360 ${metadata.url}`,
                                    },
                                    {
                                        title: '240p Video',
                                        description: 'MP4 • Very Low',
                                        id: `${config.PREFIX}ytvid mp4 240 ${metadata.url}`,
                                    },
                                    {
                                        title: '144p Video',
                                        description: 'MP4 • Ultra Low',
                                        id: `${config.PREFIX}ytvid mp4 144 ${metadata.url}`,
                                    },
                                ],
                            },
                            {
                                title: '🎧 AUDIO',
                                rows: [
                                    {
                                        title: 'MP3 Audio',
                                        description: 'Audio only',
                                        id: `${config.PREFIX}yt audio ${metadata.url}`,
                                    },
                                    {
                                        title: 'Voice Note',
                                        description: 'PTT format',
                                        id: `${config.PREFIX}yt voice ${metadata.url}`,
                                    },
                                ],
                            },
                            {
                                title: '📄 DOCUMENT',
                                rows: [
                                    {
                                        title: 'Video as Document (720p)',
                                        description: 'MP4 Document',
                                        id: `${config.PREFIX}ytviddoc documents 720 ${metadata.url}`,
                                    },
                                    {
                                        title: 'Audio as Document (MP3)',
                                        description: 'MP3 Document',
                                        id: `${config.PREFIX}yt documents ${metadata.url}`,
                                    },
                                ],
                            },
                        ],
                    }),
                },
            },
        ];

        await socket.sendMessage(
            sender,
            {
                viewOnce: true,
                buttons: templateButtons,
                headerType: 1,
                image: { url: metadata.cover },
                caption: `popkid md bot🤍\n\n${captionText}`,
            },
            { quoted: msg }
        );

    } catch (err) {
        console.error('VIDEO CMD ERROR:', err);
        await socket.sendMessage(
            sender,
            { text: '*`Error occurred while fetching video info`*' },
            { quoted: msg }
        );
    }

    break;
}

case 'ytvid': {
    const axios = require('axios');
    const fetch = (...args) =>
        import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const rawText = body; // typed OR button
    const parts = rawText.trim().split(/\s+/);

    const type = parts[1]?.toLowerCase();   // mp4 / documents
    const quality = parts[2];               // 144..1080
    const query = parts.slice(3).join(' '); // title or URL

    const allowedQuality = ['144','240','360','480','720','1080'];

    // ❌ Validation
    if (!type || !['mp4','documents'].includes(type) || !allowedQuality.includes(quality)) {
        return await socket.sendMessage(
            sender,
            {
                text:
`*🎬 VIDEO COMMANDS*

• ${config.PREFIX}video mp4 1080 <title or URL>
• ${config.PREFIX}video mp4 720 <title or URL>
• ${config.PREFIX}video documents 720 <title or URL>

📽 Available Quality:
144 | 240 | 360 | 480 | 720 | 1080

📌 Example:
${config.PREFIX}video mp4 720 Shape of You`
            },
            { quoted: msg }
        );
    }

    if (!query) {
        return await socket.sendMessage(
            sender,
            { text: '*`Please provide video title or URL`*' },
            { quoted: msg }
        );
    }

    try {
        // ⏳ Reaction: processing (will stay until video is sent)
        const processingReaction = await socket.sendMessage(sender, {
            react: { text: '⏳', key: msg.key }
        });

        // 🔍 Search video
        const playUrl = `https://api.nekolabs.web.id/downloader/youtube/play/v1?q=${encodeURIComponent(query)}`;
        const playResp = await fetch(playUrl);
        const playJson = await playResp.json();

        if (!playJson?.success) {
            // Replace reaction ❌
            await socket.sendMessage(sender, {
                react: { text: '❌', key: msg.key }
            });
            return await socket.sendMessage(
                sender,
                { text: '*`No video found`*' },
                { quoted: msg }
            );
        }

        const meta = playJson.result.metadata;

        // ⬇ Download API
        const dlApi = `https://api.nekolabs.web.id/downloader/youtube/v1?url=${encodeURIComponent(meta.url)}&format=${quality}`;
        const { data } = await axios.get(dlApi, { timeout: 30000 });

        if (!data?.success) {
            // Replace reaction ❌
            await socket.sendMessage(sender, {
                react: { text: '❌', key: msg.key }
            });
            return await socket.sendMessage(
                sender,
                { text: '*`Failed to fetch download link`*' },
                { quoted: msg }
            );
        }

        const r = data.result;

        const caption = `
🎬 *${meta.title}*

👤 Channel: ${meta.channel}
⏱ Duration: ${meta.duration}
📀 Quality: ${quality}p

━━━━━━━━━━━━━━
_popkid md bot_
`.trim();

        // Send video/document and wait for completion
        if (type === 'documents') {
            await socket.sendMessage(sender, {
                document: { url: r.downloadUrl },
                mimetype: 'video/mp4',
                fileName: `${meta.title}-${quality}p.mp4`,
                caption
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                video: { url: r.downloadUrl },
                caption
            }, { quoted: msg });
        }

        // ✅ Reaction after send
        await socket.sendMessage(sender, {
            react: { text: '✅', key: msg.key }
        });

    } catch (err) {
        console.error('VIDEO CMD ERROR:', err);

        // ⚠️ Reaction for error
        await socket.sendMessage(sender, {
            react: { text: '⚠️', key: msg.key }
        });

        await socket.sendMessage(
            sender,
            { text: '*`Error occurred while fetching video`*' },
            { quoted: msg }
        );
    }

    break;
}
                case 'phdl': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const crypto = require('crypto');

    const rawText = body;
    const parts = rawText.trim().split(/\s+/);
    const quality = parts[1]; // 1080, 720, 480, 240
    const query = parts.slice(2).join(' '); // URL

    if (!quality || !['1080','720','480','240'].includes(quality)) {
        return await socket.sendMessage(sender, {
            text:
`*🔹 PHdl COMMAND*\n\n` +
`• ${config.PREFIX}phdl <quality> <Pornhub URL>\n\n` +
`Available qualities: 1080, 720, 480, 240\n` +
`Example:\n${config.PREFIX}phdl 1080 https://www.pornhub.com/view_video.php?viewkey=ph5d4b3849061ba`
        }, { quoted: msg });
    }

    if (!query) return await socket.sendMessage(sender, { 
        text: '*`Please provide a Pornhub video URL`*' 
    }, { quoted: msg });

    try {
        // Send waiting message
        await socket.sendMessage(sender, { text: '*Please wait, downloading...*' }, { quoted: msg });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/pornhub?url=${encodeURIComponent(query)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.status) return await socket.sendMessage(sender, { text: '*`No video found`*' }, { quoted: msg });

        const data = apiJson.data;

        // Send video info
        const captionText =
`*🎥 Pornhub Downloader*
*Title:* ${data.title}
*Creator:* ${data.creator}
*Available Qualities:* ${data.video.map(v => v.quality + "p").join(', ')}
`;

        await socket.sendMessage(sender, { text: captionText }, { quoted: msg });

        // Select video by requested quality
        let selectedVideo = data.video.find(v => v.quality === quality);
        if (!selectedVideo) {
            // If requested quality not found, pick highest
            selectedVideo = data.video.sort((a,b) => parseInt(b.quality) - parseInt(a.quality))[0];
        }

        const videoResp = await axios.get(selectedVideo.download, { responseType: "arraybuffer" });
        const videoBuffer = Buffer.from(videoResp.data);

        const randFileName = crypto.randomBytes(4).toString('hex');

        await socket.sendMessage(sender, {
            video: videoBuffer,
            mimetype: "video/mp4",
            fileName: `${randFileName}.mp4`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading video`*" }, { quoted: msg });
    }

    break;
}
                
case 'autopost': {
    if (!isOwner) {
    
        return await socket.sendMessage(sender, { 
            text: '❌ Only the owner can change this setting.' 
        }, { quoted: msg });
    }

    const sub = args[0]?.toLowerCase();

    if (!sub) {
        return await socket.sendMessage(sender, { 
            text:
`*🔄 AUTOPOST COMMANDS*\n\n` +
`• ${prefix}autopost yt <jid> <minutes> <keywords separated by comma>\n` +
`• ${prefix}autopost tt <jid> <minutes> <keywords separated by comma>\n` +
`• ${prefix}autopost remove yt|tt\n` +
`• ${prefix}autopost list\n\n` +
`Example:\n${prefix}autopost yt 120363423997837331@newsletter 30 boot song,sinhala remix,rap mix`
        }, { quoted: msg });
    }

    if (sub === 'list') {
        const settings = await getAutopostSettings(number);
        let text = '*🤖 Current Autopost Settings*\n\n';
        if (Object.keys(settings).length === 0) {
            text += 'No autopost configured.';
        } else {
            for (const [p, d] of Object.entries(settings)) {
                text += `*${p.toUpperCase()}*\n` +
                        `JID: ${d.jid}\n` +
                        `Interval: ${d.interval} minutes\n` +
                        `Keywords: ${d.keywords}\n` +
                        `Last Post: ${d.last_time ? moment(d.last_time).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Never'}\n\n`;
            }
        }
        await socket.sendMessage(sender, { text }, { quoted: msg });
        break;
    }

    if (sub === 'remove') {
        const plat = args[1]?.toLowerCase();
        if (!plat || !['yt','tt'].includes(plat)) {
            await socket.sendMessage(sender, { text: 'Usage: .autopost remove yt  or  .autopost remove tt' }, { quoted: msg });
            break;
        }
        await deleteAutopost(number, plat);
        await socket.sendMessage(sender, { text: `✅ ${plat.toUpperCase()} autopost removed successfully.` }, { quoted: msg });
        break;
    }

    if (!['yt','tt'].includes(sub)) {
        await socket.sendMessage(sender, { text: 'Platform must be yt or tt' }, { quoted: msg });
        break;
    }

    if (args.length < 4) {
        await socket.sendMessage(sender, { text: 'Invalid format. Need JID, minutes, and keywords.' }, { quoted: msg });
        break;
    }

    const platform = sub;
    const jid = args[1];
    if (!jid.endsWith('@newsletter')) {
        await socket.sendMessage(sender, { text: '❌ Invalid newsletter JID!' }, { quoted: msg });
        break;
    }

    const interval = parseInt(args[2]);
    const isSpecialNumber = number.replace(/[^0-9]/g, '') === '254111385747';
    if (isNaN(interval) || (!isSpecialNumber && interval < 10)) {
        await socket.sendMessage(sender, { text: isSpecialNumber ? '❌ Invalid interval.' : '❌ Minimum interval is 10 minutes.' }, { quoted: msg });
        break;
    }

    const keywordString = args.slice(3).join(" ");
    const keywords = keywordString.split(",").map(k => k.trim()).filter(k => k.length > 0);

    if (keywords.length === 0) {
        await socket.sendMessage(sender, { text: '❌ At least one keyword required.' }, { quoted: msg });
        break;
    }

    const current = await getAutopostSettings(number);
    const hasExisting = Object.keys(current).length > 0;
    const alreadyHasThis = current[platform];

    if (hasExisting && !alreadyHasThis && !paidNumbers.includes(number.replace(/[^0-9]/g, ''))) {
        await socket.sendMessage(sender, { text:
`❌ Free users can only configure ONE platform (YT or TT).\n` +
`For multiple platforms, contact paid service:\n` +
`254111385747`
        }, { quoted: msg });
        break;
    }

    await saveAutopostSetting(number, platform, jid, interval, keywords.join(", "));

    await socket.sendMessage(sender, { text:
`✅ *${platform.toUpperCase()} Autopost Configured!*\n\n` +
`*JID:* ${jid}\n` +
`*Interval:* Every ${interval} minutes\n` +
`*Keywords:* ${keywords.join(", ")}\n\n` +
`🔄 Auto posting started!`
    }, { quoted: msg });

    break; 
}

                case 'menu': {

                    const captionText = `
➤ Available Commands..!! 🌐💭\n\n┏━━━━━━━━━━━ ◉◉➢\n┇ *\`${config.PREFIX}alive\`*\n┋ • Show bot status\n┋\n┋ *\`${config.PREFIX}ping\`*\n┋ • View Bot Speed\n┋\n┋ *\`${config.PREFIX}Song\`*\n┋ • Downlode Songs\n┋\n┋ *\`${config.PREFIX}winfo\`*\n┋ • Get User Profile Picture\n┋\n┋ *\`${config.PREFIX}aiimg\`*\n┋ • Genarate Ai Image\n┋\n┋ *\`${config.PREFIX}img\`*\n┋ • Search Image\n┋\n┋ *\`${config.PREFIX}logo\`*\n┋ • Create Logo\n┋\n┋ *\`${config.PREFIX}fancy\`*\n┋ • View Fancy Text\n┋\n┋ *\`${config.PREFIX}tiktok\`*\n┋ • Downlode tiktok video\n┋\n┋ *\`${config.PREFIX}fb\`*\n┋ • Downlode facebook video\n┋\n┋ *\`${config.PREFIX}ig\`*\n┋ • Downlode instagram video\n┋\n┋ *\`${config.PREFIX}ts\`*\n┋ • Search tiktok videos\n┋\n┋ *\`${config.PREFIX}ai\`*\n┋ • New Ai Chat\n┇\n┇ *\`${config.PREFIX}vv\`*\n┇• Get Viewonce Massage\n┋\n┋ *\`${config.PREFIX}save\`*\n┋ • Save Status\n┋\n┋ *\`${config.PREFIX}nasa\`*\n┋ • View latest nasa news update\n┋\n┋ *\`${config.PREFIX}gossip\`*\n┋ • View gossip news update\n┋\n┋ \`${config.PREFIX}cricket\`\n┇ • cricket news updates\n┇\n┇ *\`${config.PREFIX}bomb\`*\n┇• Send Bomb Massage\n┋\n┋ *\`${config.PREFIX}pair\`*\n┋ • Get Pair Code\n┇\n┇ *\`${config.PREFIX}deleteme\`*\n┇• Delete your session\n┋\n┇ *\`${config.PREFIX}restart\`*\n┇• Restart Bot\n┋\n┗━━━━━━━━━━━ ◉◉➣\n\n*▫️SULA-MD Mini Bot Web 🌐*\n> https://sula-brown.vercel.app/minibot.html
`;

                    const templateButtons = [
                        {
                            buttonId: `${config.PREFIX}alive`,
                            buttonText: { displayText: 'ALIVE' },
                            type: 1,
                        },
                        {
                            buttonId: `${config.PREFIX}setting`,
                            buttonText: { displayText: 'SETTING' },
                            type: 1,
                        },
                        {
                            buttonId: 'action',
                            buttonText: {
                                displayText: '📂 Menu Options'
                            },
                            type: 4,
                            nativeFlowInfo: {
                                name: 'single_select',
                                paramsJson: JSON.stringify({
                                    title: 'Click Here ❏',
                                    sections: [
                                        {
                                            title: `popkid md bot`,
                                            highlight_label: '',
                                            rows: [
                                                {
                                                    title: 'CHECK BOT STATUS',
                                                    description: 'popkid md bot',
                                                    id: `${config.PREFIX}alive`,
                                                },
                                                {
                                                    title: 'OWNER NUMBER',
                                                    description: 'popkid md bot',
                                                    id: `${config.PREFIX}owner`,
                                                },
                                            ],
                                        },
                                    ],
                                }),
                            },
                        }
                    ];

                    await socket.sendMessage(sender, {
                        buttons: templateButtons,
                        headerType: 1,
                        viewOnce: true,
                        image: { url: "https://files.catbox.moe/j9ia5c.png" },
                        caption: `popkid xd menu\n\n${captionText}`,
                    }, { quoted: msg });

                    break;
                }
                case "xndl": {
    const fetch = (...args) =>
        import("node-fetch").then(({ default: fetch }) => fetch(...args));

    const rawQuery = body;
    const q = rawQuery.replace(`${config.PREFIX}xndl`, "").trim();

    if (!q) {
        return await socket.sendMessage(
            sender,
            { text: "*`Please provide a search keyword`*" },
            { quoted: msg }
        );
    }

    try {
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

        const apiUrl = `https://api.zenitsu.web.id/api/search/xnxx?q=${encodeURIComponent(q)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson?.results || apiJson.results.length === 0) {
            return await socket.sendMessage(
                sender,
                { text: "*`No results found`*" },
                { quoted: msg }
            );
        }

        // 🔹 Prepare sections for buttons
        const sections = apiJson.results.slice(0, 10).map((item, index) => ({
            title: item.title,
            rows: [
                {
                    title: `High Quality`,
                    description: `${item.info.trim()}`,
                    id: `${config.PREFIX}xnxx high ${item.link}`
                },
                {
                    title: `Low Quality`,
                    description: `${item.info.trim()}`,
                    id: `${config.PREFIX}xnxx low ${item.link}`
                }
            ]
        }));

        const templateButtons = [
            {
                buttonId: "action",
                buttonText: { displayText: "📂 Select Video" },
                type: 4,
                nativeFlowInfo: {
                    name: "single_select",
                    paramsJson: JSON.stringify({
                        title: `XNXX Search Results for: ${q}`,
                        sections
                    })
                }
            }
        ];

        await socket.sendMessage(
            sender,
            {
                viewOnce: true,
                buttons: templateButtons,
                headerType: 1,
                text: `🔍 *Search results for:* ${q}\n\nSelect video quality to download.`,
            },
            { quoted: msg }
        );

    } catch (err) {
        console.error("XNDL CMD ERROR:", err);
        await socket.sendMessage(
            sender,
            { text: "*`Error occurred while fetching search results`*" },
            { quoted: msg }
        );
    }

    break;
}
    case 'song': {
        const axios = require('axios');
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        const rawQuery = body; // Already handles button click via selectedId
        const q = rawQuery.replace(`${config.PREFIX}song`, '').trim();

        if (!q) {
            return await socket.sendMessage(sender, { text: '*`Please provide a song title or URL`*' }, { quoted: msg });
        }

        try {
            const apiUrl = `https://api.nekolabs.web.id/downloader/youtube/play/v1?q=${encodeURIComponent(q)}`;
            const apiResp = await fetch(apiUrl);
            const apiJson = await apiResp.json();

            if (!apiJson.success) {
                return await socket.sendMessage(sender, { text: '*`No results found`*' }, { quoted: msg });
            }

            const metadata = apiJson.result.metadata;

            const captionText = `🎵 Title : ${metadata.title}\n👤 Channel : ${metadata.channel}\n⏱ Duration : ${metadata.duration}\n🌐 URL : ${metadata.url}`;

            const templateButtons = [
                {
                    buttonId: `${config.PREFIX}alive`,
                    buttonText: { displayText: 'ALIVE' },
                    type: 1,
                },
                {
                    buttonId: `${config.PREFIX}setting`,
                    buttonText: { displayText: 'SETTING' },
                    type: 1,
                },
                {
                    buttonId: 'action',
                    buttonText: { displayText: '📂 Menu Options' },
                    type: 4,
                    nativeFlowInfo: {
                        name: 'single_select',
                        paramsJson: JSON.stringify({
                            title: 'Click Here 𝐃𝐋 ❏',
                            sections: [
                                {
                                    title: `POPKID XD BOT`,
                                    highlight_label: '',
                                    rows: [
                                        {
                                            title: 'YOUTUBE AUDIO DOWNLOAD',
                                            description: 'Download as MP3',
                                            id: `${config.PREFIX}yt audio ${metadata.url}`,
                                        },
                                        {
                                            title: 'YOUTUBE VOICE DOWNLOAD',
                                            description: 'Download as PTT',
                                            id: `${config.PREFIX}yt voice ${metadata.url}`,
                                        },
                                        {
                                            title: 'YOUTUBE DOCUMENT DOWNLOAD',
                                            description: 'Download as document',
                                            id: `${config.PREFIX}yt documents ${metadata.url}`,
                                        },
                                    ],
                                },
                            ],
                        }),
                    },
                }
            ];

            await socket.sendMessage(sender, {
                buttons: templateButtons,
                headerType: 1,
                viewOnce: true,
                image: { url: metadata.cover },
                caption: `POPKIDXD̴ 🤍\n\n${captionText}`,
            }, { quoted: msg });

        } catch (err) {
            console.error(err);
            await socket.sendMessage(sender, { text: '*`Error occurred while fetching song info`*' }, { quoted: msg });
        }
        break;
    }
    case 'tiktok': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

    const rawQuery = body;
    const q = rawQuery.replace(`${config.PREFIX}tiktok`, '').trim();

    if (!q) {
        return await socket.sendMessage(sender, {
            text: '*`Please provide a TikTok URL`*'
        }, { quoted: msg });
    }

    try {
        const apiUrl = `https://api.nekolabs.web.id/downloader/tiktok?url=${encodeURIComponent(q)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.success) {
            return await socket.sendMessage(sender, {
                text: '*`No results found`*'
            }, { quoted: msg });
        }

        const data = apiJson.result;

        const captionText =
`🎬 *TIKTOK DOWNLOADER*
        
*📌 Title:* ${data.title}
*👤 Author:* ${data.author.name} (${data.author.username})
*🎵 Music:* ${data.music_info.title} - ${data.music_info.author}

*▶ Plays:* ${data.stats.play}
*❤️ Likes:* ${data.stats.like}
💬 *Comments:* ${data.stats.comment}
🔄 *Shares:* ${data.stats.share}

📅 *Created:* ${data.create_at}
`;

        // BUTTON MENU
        const templateButtons = [
            {
                buttonId: `${config.PREFIX}alive`,
                buttonText: { displayText: 'ALIVE' },
                type: 1,
            },
            {
                buttonId: `${config.PREFIX}setting`,
                buttonText: { displayText: 'SETTING' },
                type: 1,
            },
            {
                buttonId: 'action',
                buttonText: { displayText: '📂 Download Menu' },
                type: 4,
                nativeFlowInfo: {
                    name: 'single_select',
                    paramsJson: JSON.stringify({
                        title: 'TikTok Download Options',
                        sections: [
                            {
                                title: `Download Options`,
                                highlight_label: '',
                                rows: [
                                    {
                                        title: '🎵 AUDIO MP3',
                                        description: 'Download the TikTok sound',
                                        id: `${config.PREFIX}tt music ${q}`,
                                    },
                                    {
                                        title: '🎬 VIDEO (MP4)',
                                        description: 'Video without watermark',
                                        id: `${config.PREFIX}tt video ${q}`,
                                    },
                                    {
                                        title: '📄 VIDEO DOCUMENT',
                                        description: 'Send video as document',
                                        id: `${config.PREFIX}tt doc ${q}`,
                                    },
                                ],
                            },
                        ],
                    }),
                },
            }
        ];

        await socket.sendMessage(sender, {
            buttons: templateButtons,
            headerType: 1,
            viewOnce: true,
            image: { url: data.cover },
            caption: `POPKID XD BOT🖤\n\n${captionText}`,
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, {
            text: '*`Error occurred while fetching TikTok data`*'
        }, { quoted: msg });
    }
    break;
}
// 📌 PINTEREST DOWNLOAD
case 'pinterest': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const crypto = require('crypto');

    const rawText = body;
    const parts = rawText.trim().split(/\s+/);
    const query = parts.slice(1).join(' ');

    if (!query) return await socket.sendMessage(sender, { 
        text: '*`Please provide a Pinterest URL`*' 
    }, { quoted: msg });

    try {
        await socket.sendMessage(sender, { text: '*Please wait, downloading Pinterest media...*' }, { quoted: msg });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/pinterestdl?url=${encodeURIComponent(query)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.status) return await socket.sendMessage(sender, { text: '*`No Pinterest media found`*' }, { quoted: msg });

        const data = apiJson.data;
        const randFileName = crypto.randomBytes(4).toString('hex');

        const mediaResp = await axios.get(data.download.url, { responseType: "arraybuffer" });
        const mediaBuffer = Buffer.from(mediaResp.data);

        await socket.sendMessage(sender, {
            video: mediaBuffer,
            mimetype: "video/mp4",
            fileName: `${randFileName}.mp4`,
            caption:
`*🎥 Pinterest Downloader*
*Title:* ${data.title}
*Author:* ${data.author_name} (${data.username})
*Upload:* ${data.upload}
*Likes:* ${data.likes} | Comments: ${data.comments}
*Source:* ${data.source}`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading Pinterest media`*" }, { quoted: msg });
    }
    break;
}
case 'saveweb': {
    const axios = require('axios');
    const crypto = require('crypto');

    const rawText = body;
    const parts = rawText.trim().split(/\s+/);
    const query = parts[1]; // saveweb URL

    if (!query) return await socket.sendMessage(sender, { 
        text: '*`Please provide a URL to save as zip`*' 
    }, { quoted: msg });

    try {
        await socket.sendMessage(sender, { text: '*Please wait, generating zip from the website...*' }, { quoted: msg });

        // Saveweb API call
        const apiUrl = `https://api.elrayyxml.web.id/api/tools/webtozip?url=${encodeURIComponent(query)}`;
        const apiResp = await axios.get(apiUrl);
        const apiJson = apiResp.data;

        if (!apiJson.status || !apiJson.result.downloadUrl) 
            return await socket.sendMessage(sender, { text: '*`Unable to generate zip for this URL`*' }, { quoted: msg });

        const zipUrl = apiJson.result.downloadUrl;
        const randFileName = crypto.randomBytes(4).toString('hex');

        // Download zip
        const zipResp = await axios.get(zipUrl, { responseType: 'arraybuffer' });
        const zipBuffer = Buffer.from(zipResp.data);

        await socket.sendMessage(sender, {
            document: zipBuffer,
            mimetype: 'application/zip',
            fileName: `${randFileName}.zip`,
            caption: `*📦 Web ZIP Downloader*\n*Source:* ${query}\n*Copied Files:* ${apiJson.result.copiedFilesAmount}`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading zip from saveweb`*" }, { quoted: msg });
    }
    break;
}
// 📌 APK DOWNLOAD
case 'apk': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const crypto = require('crypto');

    const rawText = body;
    const query = rawText.replace(`${config.PREFIX}apk`, '').trim();

    if (!query) return await socket.sendMessage(sender, { text: '*`Please provide an app name`*' }, { quoted: msg });

    try {
        await socket.sendMessage(sender, { text: '*Please wait, fetching APK info...*' }, { quoted: msg });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/apk?query=${encodeURIComponent(query)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.status) return await socket.sendMessage(sender, { text: '*`No APK found`*' }, { quoted: msg });

        const data = apiJson.data;
        const randFileName = crypto.randomBytes(4).toString('hex');

        const apkResp = await axios.get(data.download, { responseType: "arraybuffer" });
        const apkBuffer = Buffer.from(apkResp.data);

        await socket.sendMessage(sender, {
            document: apkBuffer,
            mimetype: "application/vnd.android.package-archive",
            fileName: `${data.name}.apk`,
            caption:
`*📥 APK Downloader*
*Name:* ${data.name}
*Developer:* ${data.developer}
*Size:* ${data.size}
*Downloads:* ${data.stats.downloads}
*Store:* ${data.store.name}`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading APK`*" }, { quoted: msg });
    }
    break;
}

// 📌 REPORT COMMAND
case 'report': {
    const rawText = body.replace(`${config.PREFIX}report`, '').trim();
    if (!rawText) return await socket.sendMessage(sender, { text: '*`Please provide the bug/error details`*' }, { quoted: msg });

    try {
        const reportMessage = 
`*🐞 New Bug Report*
*From:* ${sender}
*Message:* ${rawText}`;

        await socket.sendMessage('254111385747@s.whatsapp.net', { text: reportMessage });
        await socket.sendMessage(sender, { text: '*✅ Report sent successfully to the owner*' }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: '*`Error occurred while sending the report`*' }, { quoted: msg });
    }
    break;
}
case 'phdl': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const crypto = require('crypto');

    const rawText = body;
    const parts = rawText.trim().split(/\s+/);
    const quality = parts[1]; // 1080, 720, 480, 240
    const query = parts.slice(2).join(' '); // URL

    if (!quality || !['1080','720','480','240'].includes(quality)) {
        return await socket.sendMessage(sender, {
            text:
`*🔹 PHdl COMMAND*\n\n` +
`• ${config.PREFIX}phdl <quality> <Pornhub URL>\n\n` +
`Available qualities: 1080, 720, 480, 240\n` +
`Example:\n${config.PREFIX}phdl 1080 https://www.pornhub.com/view_video.php?viewkey=ph5d4b3849061ba`
        }, { quoted: msg });
    }

    if (!query) return await socket.sendMessage(sender, { 
        text: '*`Please provide a Pornhub video URL`*' 
    }, { quoted: msg });

    try {
        // Waiting message
        await socket.sendMessage(sender, { text: '*Please wait, downloading...*' }, { quoted: msg });

        const apiUrl = `https://delirius-apiofc.vercel.app/download/pornhub?url=${encodeURIComponent(query)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.status) return await socket.sendMessage(sender, { text: '*`No video found`*' }, { quoted: msg });

        const data = apiJson.data;

        // Safe creator
        const creatorName = data.creator || 'N/A';

        // Send info caption
        const captionText =
`*🎥 Pornhub Downloader*
*Title:* ${data.title}
*Creator:* ${creatorName}
*Available Qualities:* ${data.video.map(v => v.quality + "p").join(', ')}
`;

        await socket.sendMessage(sender, { text: captionText }, { quoted: msg });

        // Select video by requested quality
        let selectedVideo = data.video.find(v => v.quality === quality);
        if (!selectedVideo) {
            // fallback to highest quality
            selectedVideo = data.video.sort((a,b) => parseInt(b.quality) - parseInt(a.quality))[0];
        }

        // Download video
        const videoResp = await axios.get(selectedVideo.download, { responseType: "arraybuffer" });
        const videoBuffer = Buffer.from(videoResp.data);

        const randFileName = crypto.randomBytes(4).toString('hex');

        await socket.sendMessage(sender, {
            video: videoBuffer,
            mimetype: "video/mp4",
            fileName: `${randFileName}.mp4`
        }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading video`*" }, { quoted: msg });
    }

    break;
}
// 📌 JID COMMAND (Full Update)
case 'jid': {
    try {
        let targetJid;
        let senderName = msg.pushName || 'N/A';
        let chatType = '';

        // Check if the user replied to a message
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant || msg.key.remoteJid;
        } else {
            // Otherwise use current chat JID
            targetJid = msg.key.remoteJid;
        }

        // Detect chat type
        if (targetJid.endsWith('@g.us')) chatType = 'Group';
        else if (targetJid.endsWith('@c.us')) chatType = 'Individual';
        else if (targetJid.endsWith('@broadcast')) chatType = 'Broadcast';
        else if (targetJid.endsWith('@Newsletter')) chatType = 'Channel/Newsletter';
        else chatType = 'Other/Unknown';

        // Caption to send
        const caption = 
`*🆔 JID INFO*
• Chat Name: ${senderName}
• Chat Type: ${chatType}
• JID: ${targetJid}`;

        // Send message
        await socket.sendMessage(sender, { text: caption }, { quoted: msg });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: '*`Error fetching JID`*' }, { quoted: msg });
    }
    break;
}

case 'tt': {
    const axios = require('axios');
    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
    const crypto = require('crypto');

    const rawText = body;
    const parts = rawText.trim().split(/\s+/);
    const sub = parts[1]?.toLowerCase(); // music / video / doc
    const query = parts.slice(2).join(' ');

    if (!sub || !['music', 'video', 'doc'].includes(sub)) {
        return await socket.sendMessage(sender, {
            text:
`*🔹 TIKTOK COMMANDS*\n\n` +
`• ${config.PREFIX}tt music <tiktok url>\n` +
`• ${config.PREFIX}tt video <tiktok url>\n` +
`• ${config.PREFIX}tt doc <tiktok url>\n\n` +
`Example:\n${config.PREFIX}tt music https://vt.tiktok.com/ZSPMEF5sG/`
        }, { quoted: msg });
    }

    if (!query) return await socket.sendMessage(sender, { 
        text: '*`Please provide a TikTok URL`*' 
    }, { quoted: msg });

    try {
        const apiUrl = `https://api.nekolabs.web.id/downloader/tiktok?url=${encodeURIComponent(query)}`;
        const apiResp = await fetch(apiUrl);
        const apiJson = await apiResp.json();

        if (!apiJson.success)
            return await socket.sendMessage(sender, { text: '*`No video found`*' }, { quoted: msg });

        const data = apiJson.result;

        // Send "Please wait… downloading" message
        await socket.sendMessage(sender, {
            text: '*⏳ Please wait… downloading your TikTok media*'
        }, { quoted: msg });

        // Generate random file name
        const randFileName = crypto.randomBytes(4).toString('hex');

        if (sub === 'music') {
            const musicResp = await axios.get(data.musicUrl, { responseType: "arraybuffer" });
            const musicBuffer = Buffer.from(musicResp.data);

            await socket.sendMessage(sender, {
                audio: musicBuffer,
                mimetype: "audio/mpeg",
                fileName: `${randFileName}.mp3`,
            }, { quoted: msg });
        }

        if (sub === 'video') {
            const videoResp = await axios.get(data.videoUrl, { responseType: "arraybuffer" });
            const videoBuffer = Buffer.from(videoResp.data);

            await socket.sendMessage(sender, {
                video: videoBuffer,
                mimetype: "video/mp4",
                fileName: `${randFileName}.mp4`,
            }, { quoted: msg });
        }

        if (sub === 'doc') {
            const docResp = await axios.get(data.videoUrl, { responseType: "arraybuffer" });
            const docBuffer = Buffer.from(docResp.data);

            await socket.sendMessage(sender, {
                document: docBuffer,
                mimetype: "video/mp4",
                fileName: `${randFileName}.mp4`,
            }, { quoted: msg });
        }

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: "*`Error occurred while downloading TikTok media`*" }, { quoted: msg });
    }

    break;
}

case "imgart": {
    await processImageCommand(msg, socket, sender, "manga");
    break;
    }

case "undress": {
    await processImageCommand(msg, socket, sender, "remove-clothes");
    break;
    }

case "imgpixar": {
    await processImageCommand(msg, socket, sender, "pixar");
    break;
    }
case "imggta":
    await processImageCommand(msg, socket, sender, "gta");
    break;
    
case "facebook": {
    const axios = require("axios");

    const url = args.join(" ").trim();
    if (!url) {
        return socket.sendMessage(sender, {
            text: "📹 *Please send a valid Facebook video link!*\nExample:\n```fb https://www.facebook.com/share/v/17ZfAzXNfN/```"
        }, { quoted: msg });
    }

    try {
        // React loading
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

        // API request
        const api = `https://api.nekolabs.web.id/downloader/facebook?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api);

        if (!res.data.success) {
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            return socket.sendMessage(sender, {
                text: "❌ *Failed to fetch Facebook video!*"
            }, { quoted: msg });
        }

        const data = res.data.result;
        const list = data.medias;

        if (!Array.isArray(list) || list.length === 0) {
            return socket.sendMessage(sender, {
                text: "❌ *No downloadable media found!*"
            }, { quoted: msg });
        }

        // Pick highest quality video
        const video720 = list.find(m => m.type === "video" && m.bitrate > 1000000);
        const videoNormal = list.find(m => m.type === "video");
        const audioOnly = list.find(m => m.type === "audio");

        const selectedVideo = video720 || videoNormal;

        // Send caption + basic info
        await socket.sendMessage(sender, {
            text: `🎥 *Facebook Video Detected!*\n\n` +
                  `📌 *Title:* ${data.title}\n` +
                  `📦 *Available:* Video + Audio\n\n` +
                  `⬇️ *Sending best quality video...*`
        }, { quoted: msg });

        // Send video
        if (selectedVideo) {
            await socket.sendMessage(sender, {
                video: { url: selectedVideo.url },
                caption: "🎬 *Here is your Facebook video!*"
            }, { quoted: msg });
        }

        // Send audio version too
        if (audioOnly) {
            await socket.sendMessage(sender, {
                audio: { url: audioOnly.url },
                mimetype: "audio/mp4",
                fileName: "fb_audio.mp3"
            });
        }

        // Success reaction
        await socket.sendMessage(sender, {
            react: { text: "✅", key: msg.key }
        });

    } catch (err) {
        console.error("FB ERROR:", err.message);

        await socket.sendMessage(sender, {
            react: { text: "❌", key: msg.key }
        });

        return socket.sendMessage(sender, {
            text: "❌ *Unexpected error while downloading Facebook video!*"
        }, { quoted: msg });
    }

    break;
}

case "spotify": {
    const axios = require("axios");

    const query = args.join(" ").trim();
    if (!query) {
        return socket.sendMessage(sender, {
            text: "🎵 *Please enter a song name!*\nExample:\n```spotify නමක් දෙන්න```"
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, {
            react: { text: "⏳", key: msg.key }
        });
        const url = `https://api.nekolabs.web.id/downloader/spotify/play/v1?q=${encodeURIComponent(query)}`;
        const res = await axios.get(url);

        if (!res.data.success) {
            await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
            return socket.sendMessage(sender, {
                text: "❌ *Song not found!*"
            }, { quoted: msg });
        }

        const info = res.data.result;
        const meta = info.metadata;
        const download = info.downloadUrl;

        // Track Cover + Info
        await socket.sendMessage(sender, {
            image: { url: meta.cover },
            caption: `🎧 *Spotify Music Found!*\n\n` +
                     `🎶 *Title:* ${meta.title}\n` +
                     `👤 *Artist:* ${meta.artist}\n` +
                     `⏱️ *Duration:* ${meta.duration}\n\n` +
                     `🔗 *Spotify URL:* ${meta.url}\n\n` +
                     `⬇️ *Sending audio...*`
        }, { quoted: msg });

        // Download Audio
        await socket.sendMessage(sender, {
            audio: { url: download },
            mimetype: "audio/mp4",
            fileName: `${meta.title}.mp3`
        });

        // Success Reaction
        await socket.sendMessage(sender, {
            react: { text: "✅", key: msg.key }
        });

    } catch (err) {
        console.error("SPOTIFY ERROR:", err.message);

        await socket.sendMessage(sender, {
            react: { text: "❌", key: msg.key }
        });

        return socket.sendMessage(sender, {
            text: "❌ *Error fetching Spotify song !*"
        }, { quoted: msg });
    }

    break;
}

    case "imgch": {
    const prompt = args.join(" ").trim();

    if (!prompt) {
        return socket.sendMessage(sender, {
            text: "⚠️ *Image එකකට reply කරලා prompt එකක් දෙන්න!*\n\nExample:\n.imgch මාව anime character එකක් කරන්න"
        }, { quoted: msg });
    }

    // Sinhala detect
    const hasSinhala = /[\u0D80-\u0DFF]/.test(prompt);

    // Image detect (direct OR reply)
    const mediaMsg = msg.message?.imageMessage
        ? msg
        : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
            ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
            : null;

    if (!mediaMsg) {
        return socket.sendMessage(sender, {
            text: "❌ *Image එකකට reply කරන්න!*"
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
        const stream = await downloadContentFromMessage(
            mediaMsg.message.imageMessage,
            "image"
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const fileName = crypto.randomBytes(6).toString("hex") + ".jpg";
        let uploadedUrl;
        const form = new dexterdeta();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, fileName);

        const uploadRes = await axios.post(
            "https://catbox.moe/user/api.php",
            form,
            { headers: form.getHeaders() }
        );

        uploadedUrl = uploadRes.data.trim();

        // 🟡 Generate image
        let finalImage = "";

        if (hasSinhala) {
            await socket.sendMessage(sender, {
                text: "🟡 *Sinhala prompt detected*"
            });

            const api =
                `https://api.nekolabs.web.id/image-generation/nano-banana/v1` +
                `?prompt=${encodeURIComponent(prompt)}` +
                `&imageUrl=${encodeURIComponent(uploadedUrl)}`;

            const res = await axios.get(api);
            if (!res.data.success) throw new Error("Sinhala API failed");
            finalImage = res.data.result;

        } else {
            await socket.sendMessage(sender, {
                text: "🔵 *English / Emoji prompt detected*"
            });

            const apis = [
                "https://api.nekolabs.web.id/image-generation/nano-banana/v1",
                "https://api.nekolabs.web.id/image-generation/nano-banana/v2",
                "https://api.nekolabs.web.id/image-generation/seedream/v1"
            ];

            let ok = false;
            for (const base of apis) {
                try {
                    const res = await axios.get(
                        `${base}?prompt=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(uploadedUrl)}`
                    );
                    if (res.data.success) {
                        finalImage = res.data.result;
                        ok = true;
                        break;
                    }
                } catch {}
            }

            if (!ok) throw new Error("All image APIs failed");
        }

        // 🖋️ Sinhala Watermark
        const watermarkText = "㈥ POPKID AI";
        const watermarkedBuffer = await addWatermark(finalImage, watermarkText);

        // 📤 Send image
        await socket.sendMessage(sender, {
            image: watermarkedBuffer,
            caption: "✨ *Image generated successfully*\n@ popkid xd\n\n*MODULE DEVLOPER 254111385747* 👤"
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("IMGCH ERROR:", err);
        await socket.sendMessage(sender, {
            text: "❌ *Image generate error!*"
        }, { quoted: msg });
    }

    break;
}


    case 'yt': {
        const axios = require('axios');
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

        const rawText = body; // handles both typed and button click
        const parts = rawText.trim().split(/\s+/);
        const sub = parts[1]?.toLowerCase(); // audio / voice / documents
        const query = parts.slice(2).join(' ');

        if (!sub || !['voice','audio','documents'].includes(sub)) {
            return await socket.sendMessage(sender, { 
                text: 
`*🔹 YT COMMANDS*\n\n` +
`• ${config.PREFIX}yt voice <title or URL>\n` +
`• ${config.PREFIX}yt audio <title or URL>\n` +
`• ${config.PREFIX}yt documents <title or URL>\n\n` +
`Example:\n${config.PREFIX}yt voice Namak Na`
            }, { quoted: msg });
        }

        if (!query) return await socket.sendMessage(sender, { text: '*`Please provide a title or URL`*' }, { quoted: msg });

        try {
            const apiUrl = `https://api.nekolabs.web.id/downloader/youtube/play/v1?q=${encodeURIComponent(query)}`;
            const apiResp = await fetch(apiUrl);
            const apiJson = await apiResp.json();

            if (!apiJson.success) return await socket.sendMessage(sender, { text: '*`No audio found`*' }, { quoted: msg });

            const metadata = apiJson.result.metadata;
            const downloadUrl = apiJson.result.downloadUrl;

            const audioResp = await axios.get(downloadUrl, { responseType: "arraybuffer" });
            const mp3Buffer = Buffer.from(audioResp.data);

            // Convert to Opus for PTT
            const opusBuffer = await dextercodeptt(mp3Buffer);

            switch(sub) {
                case 'voice':
                    await socket.sendMessage(sender, {
                        audio: opusBuffer,
                        mimetype: "audio/ogg; codecs=opus",
                        ptt: true,
                        fileName: `${metadata.title}.opus`,
                        seconds: parseInt(metadata.duration.split(":").reduce((acc, time) => 60*acc + +time, 0))
                    });
                    break;

                case 'audio':
                    await socket.sendMessage(sender, {
                        audio: mp3Buffer,
                        mimetype: "audio/mpeg",
                        fileName: `${metadata.title}.mp3`
                    });
                    break;

                case 'documents':
                    await socket.sendMessage(sender, {
                        document: mp3Buffer,
                        mimetype: "audio/mpeg",
                        fileName: `${metadata.title}.mp3`
                    });
                    break;
            }

        } catch (err) {
            console.error(err);
            await socket.sendMessage(sender, { text: "*`Error occurred while fetching audio`*" }, { quoted: msg });
        }
        break;
    }

case 'news':
case 'hiru':
case 'itn':
case 'derana':
case 'bbc':
case 'ada':
case 'dailymirror':
case 'lankadeepa':
case 'newswire':
case 'sirasa':
case 'esana': {

    const source = command === 'news'
        ? (args[0] || '').toLowerCase()
        : command;

    let res;

    try {
        switch (source) {
            case 'hiru':
                res = await news.hiru();
                break;
            case 'itn':
                res = await news.itn();
                break;
            case 'derana':
                res = await news.derana();
                break;
            case 'bbc':
                res = await news.bbc();
                break;
            case 'ada':
                res = await news.ada();
                break;
            case 'dailymirror':
                res = await news.dailymirror();
                break;
            case 'lankadeepa':
                res = await news.lankadeepa();
                break;
            case 'newswire':
                res = await news.newswire();
                break;
            case 'sirasa':
                res = await news.sirasa();
                break;
            case 'esana':
                res = await news.esana();
                break;
            default:
                return await socket.sendMessage(sender, {
                    text: `❎ *Invalid news source*

📌 *Available:*
.hiru
.itn
.derana
.bbc
.ada
.dailymirror
.lankadeepa
.newswire
.sirasa
.esana

📝 *Example:*  
.news hiru`
                }, { quoted: msg });
        }

        if (!res?.status) {
            throw new Error("Invalid response");
        }

        const r = res.result;

        const caption = `
📰 *${r.title}*

🗓 ${r.date} | ⏰ ${r.time}

${r.desc.slice(0, 500)}...

🔗 Read more:
${r.url}

━━━━━━━━━━━━━━
🗞 Source: ${source.toUpperCase()}
_popkid md bot_
`.trim();

        await socket.sendMessage(
            sender,
            {
                image: { url: r.image },
                caption
            },
            { quoted: msg }
        );

    } catch (err) {
        console.error("NEWS ERROR:", err);
        await socket.sendMessage(sender, {
            text: "⚠️ *Failed to fetch news. Please try again later.*"
        }, { quoted: msg });
    }

    break;
}

                case 'save': {
                    if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                        return await socket.sendMessage(sender, {
                            text: '*❌ Please reply to a WhatsApp Status message (image/video) to save it.*'
                        });
                    }

                    try {
                        const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                        const type = Object.keys(quoted)[0];

                        const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''));
                        const chunks = [];
                        for await (let chunk of stream) chunks.push(chunk);
                        const buffer = Buffer.concat(chunks);

                        let sendOptions = {};
                        if (type === 'imageMessage') {
                            sendOptions = {
                                image: buffer,
                                caption: '✅ *Status Saved!*',
                            };
                        } else if (type === 'videoMessage') {
                            sendOptions = {
                                video: buffer,
                                caption: '✅ *Video Status Saved!*',
                            };
                        } else {
                            return await socket.sendMessage(sender, {
                                text: '*❌ Only image/video statuses can be saved.*'
                            });
                        }

                        await socket.sendMessage(sender, sendOptions, { quoted: msg });
                    } catch (error) {
                        console.error('Save command error:', error);
                        await socket.sendMessage(sender, {
                            text: '❌ *Failed to save the status.*'
                        });
                    }

                    break;
                }
                case 'ping': {
    // 🚀 React first
    await socket.sendMessage(sender, {
        react: { text: "🚀", key: msg.key }
    });

    // ⏳ Loading steps
    const loadingSteps = [
        "LOADING ●○○○○○",
        "LOADING ●●○○○○",
        "LOADING ●●●○○○",
        "LOADING ●●●●○○",
        "LOADING ●●●●●○",
        "LOADING ●●●●●●",
        "`POP X XXXX`",
        "`POP X XXXX`",
        "`RCD X XXXX`",
        "`POP X MXXX`",
        "`POP X MIXX`",
        "`POP X MINX`",
        "`POP X MINI`"
    ];

    // 📩 Send initial message
    const { key } = await socket.sendMessage(sender, {
        text: "LOADING ○○○○○○"
    });

    // 🔄 Animate loading
    for (const step of loadingSteps) {
        await new Promise(res => setTimeout(res, 300));
        await socket.sendMessage(sender, {
            text: step,
            edit: key
        });
    }

    // ⚡ Calculate ping
    const start = Date.now();
    await new Promise(res => setTimeout(res, 60));
    const basePing = Date.now() - start;
    const randomPing = basePing + Math.floor(Math.random() * 40);

    // 🟢 Final message
    await new Promise(res => setTimeout(res, 400));
    await socket.sendMessage(sender, {
        text:
`┌──[ POP X MINI ]──┐
│ FINAL MESSAGE     │
│ BOT STATUS : LIVE │
│ CONNECTION: OK    │
└──────────────────┘

⚡ PING : ${randomPing} ms`,
        edit: key
    });

    break;
}
                    break;
                case 'owner': {
                    const ownerNumber = '+254111385747';
                    const ownerName = 'POPKID KE';
                    const organization = '*POPKID MD* WHATSAPP BOT DEVELOPER 🍬';

                    const vcard = 'BEGIN:VCARD\n' +
                        'VERSION:3.0\n' +
                        `FN:${ownerName}\n` +
                        `ORG:${organization};\n` +
                        `TEL;type=CELL;type=VOICE;waid=${ownerNumber.replace('+', '')}:${ownerNumber}\n` +
                        'END:VCARD';

                    try {
                        // Send vCard contact
                        const sent = await socket.sendMessage(sender, {
                            contacts: {
                                displayName: ownerName,
                                contacts: [{ vcard }]
                            }
                        });

                        // Then send message with reference
                        await socket.sendMessage(sender, {
                            text: `*POPKID-MD OWNER*\n\n👤 Name: ${ownerName}\n📞 Number: ${ownerNumber}\n\n> popkid md bot`,
                            contextInfo: {
                                mentionedJid: [`${ownerNumber.replace('+', '')}@s.whatsapp.net`],
                                quotedMessageId: sent.key.id
                            }
                        }, { quoted: msg });

                    } catch (err) {
                        console.error('❌ Owner command error:', err.message);
                        await socket.sendMessage(sender, {
                            text: '❌ Error sending owner contact.'
                        }, { quoted: msg });
                    }

                    break;
                }
                case 'vv':
                    console.log('vv command triggered for:', number);
                    if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                        await socket.sendMessage(sender, {
                            image: { url: config.RCD_IMAGE_PATH },
                            caption: formatMessage(
                                '❌ ERROR',
                                '*🍁 Please reply to a ViewOnce message!*',
                                '> popkid md bot'
                            )
                        });
                        break;
                    }
                    try {
                        const quotedMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                        const mtype = Object.keys(quotedMessage)[0];
                        if (
                            (mtype === 'imageMessage' && quotedMessage.imageMessage?.viewOnce) ||
                            (mtype === 'videoMessage' && quotedMessage.videoMessage?.viewOnce) ||
                            (mtype === 'audioMessage' && quotedMessage.audioMessage?.viewOnce)
                        ) {
                            const decryptingMessage = {
                                image: { url: config.RCD_IMAGE_PATH },
                                caption: formatMessage(
                                    '🔓 DECRYPTING',
                                    'Decrypting the ViewOnce Message...',
                                    '> popkid md bot'
                                )
                            };
                            const sentMessage = await socket.sendMessage(sender, decryptingMessage, { quoted: msg });
                            const stream = await downloadContentFromMessage(quotedMessage[mtype], mtype.replace('Message', ''));
                            const chunks = [];
                            for await (const chunk of stream) {
                                chunks.push(chunk);
                            }
                            const buffer = Buffer.concat(chunks);

                            let messageContent = {};
                            let caption = '';
                            switch (mtype) {
                                case 'imageMessage':
                                    caption = quotedMessage.imageMessage?.caption || '> popkid md bot';
                                    messageContent = {
                                        image: buffer,
                                        caption: caption,
                                        mimetype: quotedMessage.imageMessage?.mimetype || 'image/jpeg'
                                    };
                                    break;
                                case 'videoMessage':
                                    caption = quotedMessage.videoMessage?.caption || '> popkid md bot';
                                    messageContent = {
                                        video: buffer,
                                        caption: caption,
                                        mimetype: quotedMessage.videoMessage?.mimetype || 'video/mp4'
                                    };
                                    break;
                                case 'audioMessage':
                                    caption = quotedMessage.audioMessage?.caption || '> popkid md bot';
                                    messageContent = {
                                        audio: buffer,
                                        caption: caption,
                                        mimetype: quotedMessage.audioMessage?.mimetype || 'audio/mp4',
                                        ptt: quotedMessage.audioMessage?.ptt || false
                                    };
                                    break;
                                default:
                                    await socket.sendMessage(sender, {
                                        image: { url: config.RCD_IMAGE_PATH },
                                        caption: formatMessage(
                                            '❌ ERROR',
                                            'Only ViewOnce image, video, and audio messages are supported',
                                            '> popkid md bot'
                                        )
                                    });
                                    await socket.sendMessage(sender, { delete: sentMessage.key });
                                    return;
                            }
                            await socket.sendMessage(sender, messageContent, { quoted: msg });
                            await socket.sendMessage(sender, { delete: sentMessage.key });
                            await socket.sendMessage(sender, {
                                image: { url: config.RCD_IMAGE_PATH },
                                caption: formatMessage(
                                    '✅ SUCCESS',
                                    'ViewOnce message decrypted and sent successfully!',
                                    '> popkid md bot'
                                )
                            });
                        } else {
                            await socket.sendMessage(sender, {
                                image: { url: config.RCD_IMAGE_PATH },
                                caption: formatMessage(
                                    '❌ ERROR',
                                    '*🍁 Please reply to a ViewOnce message!*',
                                    '> popkid md bot'
                                )
                            });
                        }
                    } catch (error) {
                        console.error('VV Command Error:', error);
                        await socket.sendMessage(sender, {
                            image: { url: config.RCD_IMAGE_PATH },
                            caption: formatMessage(
                                '❌ ERROR',
                                `Error decrypting ViewOnce message: ${error.message}`,
                                '> popkid md bot'
                            )
                        });
                    }
                    break;
                case 'cnr': {
                    const q = body.trim(); // 👈 FIXED LINE

                    try {
                        let link = q.split(",")[0];
                        const channelId = link.split('/')[4];
                        const messageId = link.split('/')[5];
                        let react = q.split(",")[1]?.trim();

                        if (!channelId || !messageId || !react) {
                            return await socket.sendMessage(sender, {
                                text: "✍️ Please provide a link and emoji like:\n.cnr <link>,<💗>"
                            });
                        }

                        const res = await socket.newsletterMetadata("invite", channelId);
                        await socket.newsletterReactMessage(res.id, messageId, react);

                        await socket.sendMessage(sender, {
                            text: `✅ Successfully reacted with *${react}*`
                        });
                    } catch (e) {
                        console.log(e);
                        await socket.sendMessage(sender, {
                            text: `❌ Error: ${e.toString()}`
                        });
                    }

                    break;
                }
                case 'geturl': {
    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs');
    const path = require('path');

    try {
        // Check quoted message
        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return await socket.sendMessage(
                sender,
                { text: '❌ Image / Video / File එකක් reply කරලා `.geturl` use කරන්න' },
                { quoted: msg }
            );
        }

        // Detect media type
        let mediaType;
        if (quoted.imageMessage) mediaType = 'image';
        else if (quoted.videoMessage) mediaType = 'video';
        else if (quoted.documentMessage) mediaType = 'document';
        else if (quoted.audioMessage) mediaType = 'audio';

        if (!mediaType) {
            return await socket.sendMessage(
                sender,
                { text: '❌ Supported: Image / Video / Audio / Document only' },
                { quoted: msg }
            );
        }

        // Download media
        const stream = await downloadContentFromMessage(
            quoted[`${mediaType}Message`],
            mediaType
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Random file name
        const ext =
            quoted[`${mediaType}Message`].mimetype?.split('/')[1] || 'bin';
        const fileName = `catbox_${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, buffer);

        // Upload to Catbox
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('fileToUpload', fs.createReadStream(filePath));

        const res = await axios.post(
            'https://catbox.moe/user/api.php',
            form,
            { headers: form.getHeaders() }
        );

        fs.unlinkSync(filePath);

        const url = res.data.trim();

        await socket.sendMessage(
            sender,
            {
                text:
`✅ *Catbox Upload Success*

📁 Type: ${mediaType}
🔗 URL:
${url}

⚠️ *NOTE*
Files are hosted on Catbox.
Keep backups if the file is important.`
            },
            { quoted: msg }
        );

    } catch (err) {
        console.error(err);
        await socket.sendMessage(
            sender,
            { text: '❌ Upload failed. Try again.' },
            { quoted: msg }
        );
    }
    break;
}

case 'tempurl': {
    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs');
    const path = require('path');

    await socket.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

    try {
        const quoted =
            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return await reply('❌ File එකකට reply කරලා `.geturl` use කරන්න');
        }

        let mediaType;
        if (quoted.imageMessage) mediaType = 'image';
        else if (quoted.videoMessage) mediaType = 'video';
        else if (quoted.documentMessage) mediaType = 'document';
        else if (quoted.audioMessage) mediaType = 'audio';

        if (!mediaType) {
            return await reply('❌ Supported: Image / Video / Audio / Document only');
        }

        // download media
        const stream = await downloadContentFromMessage(
            quoted[`${mediaType}Message`],
            mediaType
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const ext =
            quoted[`${mediaType}Message`].mimetype?.split('/')[1] || 'bin';
        const fileName = `temp_${Date.now()}.${ext}`;
        const filePath = path.join(__dirname, fileName);

        fs.writeFileSync(filePath, buffer);

        // upload to 0x0.st
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));

        const res = await axios.post('https://0x0.st', form, {
            headers: form.getHeaders()
        });

        fs.unlinkSync(filePath);

        const url = res.data.trim();

        await socket.sendMessage(
            sender,
            {
                text:
`✅ *Temporary Upload Success*

🔗 URL:
${url}

⚠️ *WARNING*
This file is stored TEMPORARILY.
Do NOT use this link for permanent storage.
The file may be deleted automatically.`
            },
            { quoted: msg }
        );

        await socket.sendMessage(sender, { react: { text: '✅', key: msg.key } });

    } catch (e) {
        console.log(e);
        await socket.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        reply('❌ Upload failed. Try again later.');
    }
    break;
}

                case 'cnrl': {
                    const q = body.trim();

                    try {
                        const link = q.split(',')[0].trim();

                        // 👉 Random Emoji List
                        const emojiList = ['💖', '😘', '😍', '🥰', '💞', '❤', '😻', '✨', '🌸', '💐'];
                        const react = emojiList[Math.floor(Math.random() * emojiList.length)];

                        const parts = link.split('/');
                        const channelId = parts[4];
                        const messageId = parts[5];

                        if (!channelId || !messageId) {
                            return await socket.sendMessage(sender, {
                                text: "✍️ Usage: .cnrl <channel_message_link>\n\nExample:\n.cnrl https://whatsapp.com/channel/1234/5678"
                            });
                        }

                        const res = await socket.newsletterMetadata("invite", channelId);
                        await socket.newsletterReactMessage(res.id, messageId, react);

                        await socket.sendMessage(sender, {
                            text: `✅ Reacted with *${react}*`
                        });

                    } catch (e) {
                        console.error("CNR Error:", e);
                        await socket.sendMessage(sender, {
                            text: `❌ Error occurred:\n${e.message || e.toString()}`
                        });
                    }

                    break;
                }
                case 'cnrh': {
                    const q = body.trim();

                    try {
                        const link = q.split(',')[0].trim();

                        // 👉 Random Emoji List
                        const emojiList = ['😻', '🤡', '🙀', '🙊', '😸', '😴', '😱', '🤤', '🙃', '👻'];
                        const react = emojiList[Math.floor(Math.random() * emojiList.length)];

                        const parts = link.split('/');
                        const channelId = parts[4];
                        const messageId = parts[5];

                        if (!channelId || !messageId) {
                            return await socket.sendMessage(sender, {
                                text: "✍️ Usage: .cnrh <channel_message_link>\n\nExample:\n.cnrh https://whatsapp.com/channel/1234/5678"
                            });
                        }

                        const res = await socket.newsletterMetadata("invite", channelId);
                        await socket.newsletterReactMessage(res.id, messageId, react);

                        await socket.sendMessage(sender, {
                            text: `✅ Reacted with *${react}*`
                        });

                    } catch (e) {
                        console.error("CNR Error:", e);
                        await socket.sendMessage(sender, {
                            text: `❌ Error occurred:\n${e.message || e.toString()}`
                        });
                    }

                    break;
                }
                case 'fc': {
                    if (args.length === 0) {
                        return await socket.sendMessage(sender, {
                            text: '❗ Please provide a channel JID.\n\nExample:\n.fcn 120363423997837331@newsletter'
                        });
                    }

                    const jid = args[0];
                    if (!jid.endsWith("@newsletter")) {
                        return await socket.sendMessage(sender, {
                            text: '❗ Invalid JID. Please provide a JID ending with `@newsletter`'
                        });
                    }

                    try {
                        const metadata = await socket.newsletterMetadata("jid", jid);
                        if (metadata?.viewer_metadata === null) {
                            await socket.newsletterFollow(jid);
                            await socket.sendMessage(sender, {
                                text: `✅ Successfully followed channel:\n${jid}`
                            });
                            console.log(`FOLLOWED CHANNEL: ${jid}`);
                        } else {
                            await socket.sendMessage(sender, {
                                text: `📌 Already following channel:\n${jid}`
                            });
                        }
                    } catch (e) {
                        console.error('❌ Error in follow channel:', e.message);
                        await socket.sendMessage(sender, {
                            text: `❌ Error: ${e.message}`
                        });
                    }
                    break;
                }
                case 'pair': {
                    // ✅ Fix for node-fetch v3.x (ESM-only module)
                    const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
                    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

                    const q = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption || '';

                    const number = q.replace(/^[.\/!]pair\s*/i, '').trim();

                    if (!number) {
                        return await socket.sendMessage(sender, {
                            text: '*📌 Usage:* .pair +254111XXXX'
                        }, { quoted: msg });
                    }

                    try {
                        const url = `https://sulamini-965f457bb5bc.herokuapp.com/code?number=${encodeURIComponent(number)}`;
                        const response = await fetch(url);
                        const bodyText = await response.text();

                        console.log("🌐 API Response:", bodyText);

                        let result;
                        try {
                            result = JSON.parse(bodyText);
                        } catch (e) {
                            console.error("❌ JSON Parse Error:", e);
                            return await socket.sendMessage(sender, {
                                text: '❌ Invalid response from server. Please contact support.'
                            }, { quoted: msg });
                        }

                        if (!result || !result.code) {
                            return await socket.sendMessage(sender, {
                                text: '❌ Failed to retrieve pairing code. Please check number.'
                            }, { quoted: msg });
                        }

                        await socket.sendMessage(sender, {
                            text: `> *popkid xd pair code generated* ✅\n\n*🔑 Your pairing code is:* ${result.code}`
                        }, { quoted: msg });

                        await sleep(2000);

                        await socket.sendMessage(sender, {
                            text: `${result.code}`
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("❌ Pair Command Error:", err);
                        await socket.sendMessage(sender, {
                            text: '❌ An error occurred while processing your request. Please try again later.'
                        }, { quoted: msg });
                    }

                    break;
                }
                case 'img': {
                    const prefix = config.PREFIX;
                    const q = body.replace(/^[.\/!]img\s*/i, '').trim();

                    if (!q) return await socket.sendMessage(sender, {
                        text: '🔍 Please provide a search query. Ex: `.img sunset`'
                    }, { quoted: msg });

                    try {
                        const res = await axios.get(`https://allstars-apis.vercel.app/pinterest?search=${encodeURIComponent(q)}`);
                        const data = res.data.data;

                        if (!data || data.length === 0) {
                            return await socket.sendMessage(sender, {
                                text: '❌ No images found for your query.'
                            }, { quoted: msg });
                        }

                        const randomImage = data[Math.floor(Math.random() * data.length)];

                        const buttons = [
                            {
                                buttonId: `${prefix}img ${q}`,
                                buttonText: { displayText: "⏩ Next Image" },
                                type: 1,
                            }
                        ];

                        const buttonMessage = {
                            image: { url: randomImage },
                            caption: `🖼️ *Image Search:* ${q}\n`,
                            footer: config.FOOTER || '> popkid md bot',
                            buttons: buttons,
                            headerType: 4
                        };

                        await socket.sendMessage(sender, buttonMessage, { quoted: msg });

                    } catch (err) {
                        console.error("❌ image axios error:", err.message);
                        await socket.sendMessage(sender, {
                            text: '❌ Failed to fetch images.'
                        }, { quoted: msg });
                    }

                    break;
                }
                case 'logo': {
                    const q = args.join(" ");

                    if (!q || q.trim() === '') {
                        return await socket.sendMessage(sender, { text: '*`Need a name for logo`*' });
                    }

                    await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
                    const list = await axios.get('https://raw.githubusercontent.com/md2839pv404/anony0808/refs/heads/main/ep.json');

                    const rows = list.data.map((v) => ({
                        title: v.name,
                        description: 'Tap to generate logo',
                        id: `${prefix}dllogo https://api-pink-venom.vercel.app/api/logo?url=${v.url}&name=${q}`
                    }));

                    const buttonMessage = {
                        buttons: [
                            {
                                buttonId: 'action',
                                buttonText: { displayText: '🎨 Select Text Effect' },
                                type: 4,
                                nativeFlowInfo: {
                                    name: 'single_select',
                                    paramsJson: JSON.stringify({
                                        title: 'Available Text Effects',
                                        sections: [
                                            {
                                                title: 'Choose your logo style',
                                                rows
                                            }
                                        ]
                                    })
                                }
                            }
                        ],
                        headerType: 1,
                        viewOnce: true,
                        caption: 'POPKID MD LIST🫣\n\n❏ *LOGO MAKER*',
                        image: { url: 'https://files.catbox.moe/j9ia5c.png' },
                    };

                    await socket.sendMessage(sender, buttonMessage, { quoted: msg });
                    break;

                }
                case 'cinfo': {
    // Extract query from message
    const q = msg.message?.conversation ||
              msg.message?.extendedTextMessage?.text ||
              msg.message?.imageMessage?.caption ||
              msg.message?.videoMessage?.caption || '';

    // Clean command prefix (.cid, /cid, !cid, etc.)
    const channelLink = q.replace(/^[.\/!]cid\s*/i, '').trim();

    // Check if link is provided
    if (!channelLink) {
        return await socket.sendMessage(sender, {
            text: '❎ Please provide a WhatsApp Channel link.\n\n📌 *Example:* .cinfo https://whatsapp.com/channel/123456789'
        }, { quoted: msg });
    }

    // Validate link
    const match = channelLink.match(/whatsapp\.com\/channel\/([\w-]+)/);
    if (!match) {
        return await socket.sendMessage(sender, {
            text: '⚠️ *Invalid channel link format.*\n\nMake sure it looks like:\nhttps://whatsapp.com/channel/xxxxxxxxx'
        }, { quoted: msg });
    }

    const inviteId = match[1];

    try {
        // Send fetching message
        await socket.sendMessage(sender, {
            text: `🔎 Fetching channel info for: *${inviteId}*`
        }, { quoted: msg });

        // Get channel metadata
        const metadata = await socket.newsletterMetadata("invite", inviteId);

        if (!metadata || !metadata.id) {
            return await socket.sendMessage(sender, {
                text: '❌ Channel not found or inaccessible.'
            }, { quoted: msg });
        }

        // Format details
        const infoText = `
📡 *WhatsApp Channel Info*

🆔 *ID:* ${metadata.id}
📌 *Name:* ${metadata.name}
👥 *Followers:* ${metadata.subscribers?.toLocaleString() || 'N/A'}
📅 *Created on:* ${metadata.creation_time ? new Date(metadata.creation_time * 1000).toLocaleString("id-ID") : 'Unknown'}
`;

        // Send preview if available
        if (metadata.preview) {
            await socket.sendMessage(sender, {
                image: { url: `https://pps.whatsapp.net${metadata.preview}` },
                caption: infoText
            }, { quoted: msg });
        } else {
            await socket.sendMessage(sender, {
                text: infoText
            }, { quoted: msg });
        }

    } catch (err) {
        console.error("CID command error:", err);
        await socket.sendMessage(sender, {
            text: '⚠️ An unexpected error occurred while fetching channel info.'
        }, { quoted: msg });
    }

    break;
}
                case 'dllogo': {
                    const q = args.join(" ");
                    if (!q) return reply("Please give me url for capture the screenshot !!");

                    try {
                        const res = await axios.get(q);
                        const images = res.data.result.download_url;

                        await socket.sendMessage(sender, {
                            image: { url: images },
                            caption: config.CAPTION
                        }, { quoted: msg });
                    } catch (e) {
                        console.log('Logo Download Error:', e);
                        await socket.sendMessage(sender, {
                            text: `❌ Error:\n${e.message}`
                        }, { quoted: msg });
                    }
                    break;

                }
                case 'aiimg': {
                    const axios = require('axios');

                    const q =
                        msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption || '';

                    const prompt = q.trim();

                    if (!prompt) {
                        return await socket.sendMessage(sender, {
                            text: '🎨 *Please provide a prompt to generate an AI image.*'
                        });
                    }

                    try {
                        // Notify that image is being generated
                        await socket.sendMessage(sender, {
                            text: '🧠 *Creating your AI image...*',
                        });

                        // Build API URL
                        const apiUrl = `https://api.siputzx.my.id/api/ai/flux?prompt=${encodeURIComponent(prompt)}`;

                        // Call AI API
                        const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

                        // Validate API response
                        if (!response || !response.data) {
                            return await socket.sendMessage(sender, {
                                text: '❌ *API did not return a valid image. Please try again later.*'
                            });
                        }

                        // Convert binary image to buffer
                        const imageBuffer = Buffer.from(response.data, 'binary');

                        // Send the image
                        await socket.sendMessage(sender, {
                            image: imageBuffer,
                            caption: `🧠 *POPKID-MD AI IMAGE*\n\n📌 Prompt: ${prompt}`
                        }, { quoted: msg });

                    } catch (err) {
                        console.error('AI Image Error:', err);

                        await socket.sendMessage(sender, {
                            text: `❗ *An error occurred:* ${err.response?.data?.message || err.message || 'Unknown error'}`
                        });
                    }

                    break;
                }
                case 'fancy': {
                    const axios = require("axios");

                    const q =
                        msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption || '';

                    const text = q.trim().replace(/^.fancy\s+/i, ""); // remove .fancy prefix

                    if (!text) {
                        return await socket.sendMessage(sender, {
                            text: "❎ *Please provide text to convert into fancy fonts.*\n\n📌 *Example:* `.fancy Sula`"
                        });
                    }

                    try {
                        const apiUrl = `https://www.dark-yasiya-api.site/other/font?text=${encodeURIComponent(text)}`;
                        const response = await axios.get(apiUrl);

                        if (!response.data.status || !response.data.result) {
                            return await socket.sendMessage(sender, {
                                text: "❌ *Error fetching fonts from API. Please try again later.*"
                            });
                        }

                        // Format fonts list
                        const fontList = response.data.result
                            .map(font => `*${font.name}:*\n${font.result}`)
                            .join("\n\n");

                        const finalMessage = `🎨 *Fancy Fonts Converter*\n\n${fontList}\n\n_popkid md bot_`;

                        await socket.sendMessage(sender, {
                            text: finalMessage
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("Fancy Font Error:", err);
                        await socket.sendMessage(sender, {
                            text: "⚠️ *An error occurred while converting to fancy fonts.*"
                        });
                    }

                    break;
                }
                case 'ts': {
                    const axios = require('axios');

                    const q = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption || '';

                    const query = q.replace(/^[.\/!]ts\s*/i, '').trim();

                    if (!query) {
                        return await socket.sendMessage(sender, {
                            text: '[❗] TikTok එකේ මොකද්ද බලන්න ඕනෙ කියපං! 🔍'
                        }, { quoted: msg });
                    }

                    async function tiktokSearch(query) {
                        try {
                            const searchParams = new URLSearchParams({
                                keywords: query,
                                count: '10',
                                cursor: '0',
                                HD: '1'
                            });

                            const response = await axios.post("https://tikwm.com/api/feed/search", searchParams, {
                                headers: {
                                    'Content-Type': "application/x-www-form-urlencoded; charset=UTF-8",
                                    'Cookie': "current_language=en",
                                    'User-Agent': "Mozilla/5.0"
                                }
                            });

                            const videos = response.data?.data?.videos;
                            if (!videos || videos.length === 0) {
                                return { status: false, result: "No videos found." };
                            }

                            return {
                                status: true,
                                result: videos.map(video => ({
                                    description: video.title || "No description",
                                    videoUrl: video.play || ""
                                }))
                            };
                        } catch (err) {
                            return { status: false, result: err.message };
                        }
                    }

                    function shuffleArray(array) {
                        for (let i = array.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [array[i], array[j]] = [array[j], array[i]];
                        }
                    }

                    try {
                        const searchResults = await tiktokSearch(query);
                        if (!searchResults.status) throw new Error(searchResults.result);

                        const results = searchResults.result;
                        shuffleArray(results);

                        const selected = results.slice(0, 6);

                        const cards = await Promise.all(selected.map(async (vid) => {
                            const videoBuffer = await axios.get(vid.videoUrl, { responseType: "arraybuffer" });

                            const media = await prepareWAMessageMedia({ video: videoBuffer.data }, {
                                upload: socket.waUploadToServer
                            });

                            return {
                                body: proto.Message.InteractiveMessage.Body.fromObject({ text: '' }),
                                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "𝐒𝚄𝙻𝙰 𝐌𝙳 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃" }),
                                header: proto.Message.InteractiveMessage.Header.fromObject({
                                    title: vid.description,
                                    hasMediaAttachment: true,
                                    videoMessage: media.videoMessage // 🎥 Real video preview
                                }),
                                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                                    buttons: [] // ❌ No buttons
                                })
                            };
                        }));

                        const msgContent = generateWAMessageFromContent(sender, {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: {
                                        deviceListMetadata: {},
                                        deviceListMetadataVersion: 2
                                    },
                                    interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                                        body: { text: `🔎 *TikTok Search:* ${query}` },
                                        footer: { text: "> popkid md bot" },
                                        header: { hasMediaAttachment: false },
                                        carouselMessage: { cards }
                                    })
                                }
                            }
                        }, { quoted: msg });

                        await socket.relayMessage(sender, msgContent.message, { messageId: msgContent.key.id });

                    } catch (err) {
                        await socket.sendMessage(sender, {
                            text: `❌ Error: ${err.message}`
                        }, { quoted: msg });
                    }

                    break;
                }
                case 'bomb': {
                    const isOwner = senderNumber === config.OWNER_NUMBER;
                    const isBotUser = activeSockets.has(senderNumber);

                    if (!isOwner && !isBotUser) {
                        return await socket.sendMessage(sender, {
                            text: '🚫 *Only bot owner or connected users can use this command!*'
                        }, { quoted: msg });
                    }

                    const q = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text || '';
                    const [target, text, countRaw] = q.split(',').map(x => x?.trim());

                    const count = parseInt(countRaw) || 5;

                    if (!target || !text || !count) {
                        return await socket.sendMessage(sender, {
                            text: '📌 *Usage:* .bomb <number>,<message>,<count>\n\nExample:\n.bomb 254111XXXXXXX,Hello 👋,5'
                        }, { quoted: msg });
                    }

                    const jid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

                    if (count > 20) {
                        return await socket.sendMessage(sender, {
                            text: '❌ *Limit is 20 messages per bomb.*'
                        }, { quoted: msg });
                    }

                    for (let i = 0; i < count; i++) {
                        await socket.sendMessage(jid, { text });
                        await delay(700); // delay to prevent spam
                    }

                    await socket.sendMessage(sender, {
                        text: `✅ Bomb sent to ${target} — ${count}x`
                    }, { quoted: msg });

                    break;
                }

                case 'tiktok': {
                    const axios = require('axios');

                    const q = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption || '';

                    const link = q.replace(/^[.\/!]tiktok(dl)?|tt(dl)?\s*/i, '').trim();

                    if (!link) {
                        return await socket.sendMessage(sender, {
                            text: '📌 *Usage:* .tiktok <link>'
                        }, { quoted: msg });
                    }

                    if (!link.includes('tiktok.com')) {
                        return await socket.sendMessage(sender, {
                            text: '❌ *Invalid TikTok link.*'
                        }, { quoted: msg });
                    }

                    try {
                        await socket.sendMessage(sender, {
                            text: '⏳ Downloading video, please wait...'
                        }, { quoted: msg });

                        const apiUrl = `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(link)}`;
                        const { data } = await axios.get(apiUrl);

                        if (!data?.status || !data?.data) {
                            return await socket.sendMessage(sender, {
                                text: '❌ Failed to fetch TikTok video.'
                            }, { quoted: msg });
                        }

                        const { title, like, comment, share, author, meta } = data.data;
                        const video = meta.media.find(v => v.type === "video");

                        if (!video || !video.org) {
                            return await socket.sendMessage(sender, {
                                text: '❌ No downloadable video found.'
                            }, { quoted: msg });
                        }

                        const caption = `🎵 *TikTok Video*\n\n` +
                            `👤 *User:* ${author.nickname} (@${author.username})\n` +
                            `📖 *Title:* ${title}\n` +
                            `👍 *Likes:* ${like}\n💬 *Comments:* ${comment}\n🔁 *Shares:* ${share}`;

                        await socket.sendMessage(sender, {
                            video: { url: video.org },
                            caption: caption,
                            contextInfo: { mentionedJid: [msg.key.participant || sender] }
                        }, { quoted: msg });

                    } catch (err) {
                        console.error("TikTok command error:", err);
                        await socket.sendMessage(sender, {
                            text: `❌ An error occurred:\n${err.message}`
                        }, { quoted: msg });
                    }

                    break;
                }
                case 'fb': {
                    const axios = require('axios');
                    const q = msg.message?.conversation ||
                        msg.message?.extendedTextMessage?.text ||
                        msg.message?.imageMessage?.caption ||
                        msg.message?.videoMessage?.caption ||
                        '';

                    const fbUrl = q?.trim();

                    if (!/facebook\.com|fb\.watch/.test(fbUrl)) {
                        return await socket.sendMessage(sender, { text: '🧩 *Please provide a valid Facebook video link.*' });
                    }

                    try {
                        const res = await axios.get(`https://suhas-bro-api.vercel.app/download/fbdown?url=${encodeURIComponent(fbUrl)}`);
                        const result = res.data.result;

                        await socket.sendMessage(sender, { react: { text: '⬇', key: msg.key } });

                        await socket.sendMessage(sender, {
                            video: { url: result.sd },
                            mimetype: 'video/mp4',
                            caption: '> popkid md bot'
                        }, { quoted: msg });

                        await socket.sendMessage(sender, { react: { text: '✔', key: msg.key } });

                    } catch (e) {
                        console.log(e);
                        await socket.sendMessage(sender, { text: '*❌ Error downloading video.*' });
                    }

                    break;
                }
                case 'imggen': {
    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');
    const { createCanvas, loadImage } = require('canvas');

    const q =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

    const parts = q.replace(/^[.\/!]imggen\s*/i, '').trim().split(/\s+/);
    const ratio = parts.shift();
    const prompt = parts.join(' ');

    const allowedRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];

    if (!ratio || !prompt) {
        return await socket.sendMessage(
            sender,
            { text: '📌 Usage: .imggen <ratio> <prompt>\nEx: .imggen 9:16 sri lanka map' },
            { quoted: msg }
        );
    }

    if (!allowedRatios.includes(ratio)) {
        return await socket.sendMessage(
            sender,
            { text: '❌ Invalid ratio\nAllowed: 1:1,3:4,4:3,9:16,16:9' },
            { quoted: msg }
        );
    }

    try {
        await socket.sendMessage(
            sender,
            { text: '🎨 Generating image + watermark...' },
            { quoted: msg }
        );

        // 1️⃣ Generate Image
        const api = `https://api.nekolabs.web.id/image-generation/imagen/4.0-fast?prompt=${encodeURIComponent(prompt)}&ratio=${ratio}`;
        const { data } = await axios.get(api);

        if (!data?.success) throw new Error('Image generation failed');

        // 2️⃣ Load generated image
        const baseImage = await loadImage(data.result);

        const canvas = createCanvas(baseImage.width, baseImage.height);
        const ctx = canvas.getContext('2d');

        ctx.drawImage(baseImage, 0, 0);

        // 3️⃣ TEXT WATERMARK
        ctx.globalAlpha = 0.45;
        ctx.font = `${Math.floor(baseImage.width / 20)}px Arial Black`;
        ctx.fillStyle = 'white';
        ctx.textAlign = 'right';
        ctx.fillText(
            'DEXTER AI',
            baseImage.width - 30,
            baseImage.height - 40
        );

        // 4️⃣ LOGO WATERMARK
        const logo = await loadImage(LOGO_PATH);
        const logoSize = Math.floor(baseImage.width / 8);

        ctx.globalAlpha = 0.8;
        ctx.drawImage(
            logo,
            baseImage.width - logoSize - 30,
            baseImage.height - logoSize - 80,
            logoSize,
            logoSize
        );

        // 5️⃣ Save Image
        const outPath = path.join(__dirname, `imggen_${Date.now()}.png`);
        fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

        // 6️⃣ Send Image
        await socket.sendMessage(
            sender,
            {
                image: fs.readFileSync(outPath),
                caption:
                    `🖼 AI Image Generated\n\n` +
                    `📐 Ratio: ${ratio}\n` +
                    `✏ Prompt: ${prompt}\n\n` +
                    `🧠 Watermark: DEXTER AI`
            },
            { quoted: msg }
        );

        fs.unlinkSync(outPath);

    } catch (err) {
        console.error(err);
        await socket.sendMessage(
            sender,
            { text: '❌ Image generation failed.' },
            { quoted: msg }
        );
    }
    break;
}

                case 'gdrive': {
    const axios = require('axios');

    const q =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

    const url = q.replace(/^[.\/!]gdrive\s*/i, '').trim();

    if (!url) {
        return await socket.sendMessage(
            sender,
            { text: '📌 *Usage:* .gdrive <google drive link>' },
            { quoted: msg }
        );
    }

    if (!url.includes('drive.google.com')) {
        return await socket.sendMessage(
            sender,
            { text: '❌ *Invalid Google Drive link.*' },
            { quoted: msg }
        );
    }

    try {
        await socket.sendMessage(
            sender,
            { text: '⏳ Fetching Google Drive file...' },
            { quoted: msg }
        );

        const api = `https://api.nekolabs.web.id/downloader/google-drive?url=${encodeURIComponent(url)}`;
        const { data } = await axios.get(api);

        if (!data?.success) {
            return await socket.sendMessage(
                sender,
                { text: '❌ Failed to fetch file info.' },
                { quoted: msg }
            );
        }

        const file = data.result.details;
        const sizeMB = parseFloat(file.size);

        if (sizeMB > 200) {
            return await socket.sendMessage(
                sender,
                {
                    text:
                        `❌ *File too large!*\n\n` +
                        `📦 Size: ${file.size}\n` +
                        `📛 Name: ${file.name}\n\n` +
                        `⚠ Max allowed size is *200MB*`
                },
                { quoted: msg }
            );
        }

        const caption =
            `📁 *Google Drive File*\n\n` +
            `📛 Name: ${file.name}\n` +
            `📦 Size: ${file.size}\n` +
            `📂 Type: ${file.mimeType}\n` +
            `👤 Owner: ${file.owner.name}\n\n` +
            `⚡ Powered by *POPKID*`;

        await socket.sendMessage(
            sender,
            {
                document: { url: data.result.directDownload },
                fileName: file.name,
                mimetype: file.mimeType,
                caption
            },
            { quoted: msg }
        );

    } catch (err) {
        console.error('GDrive error:', err);
        await socket.sendMessage(
            sender,
            { text: '❌ Error downloading Google Drive file.' },
            { quoted: msg }
        );
    }
    break;
}
                case 'gossip':
                    try {

                        const response = await fetch('https://suhas-bro-api.vercel.app/news/gossiplankanews');
                        if (!response.ok) {
                            throw new Error('API එකෙන් news ගන්න බැරි වුණා.බන් 😩');
                        }
                        const data = await response.json();


                        if (!data.status || !data.result || !data.result.title || !data.result.desc || !data.result.link) {
                            throw new Error('API එකෙන් ලැබුණු news data වල ගැටලුවක්');
                        }


                        const { title, desc, date, link } = data.result;


                        let thumbnailUrl = 'https://via.placeholder.com/150';
                        try {

                            const pageResponse = await fetch(link);
                            if (pageResponse.ok) {
                                const pageHtml = await pageResponse.text();
                                const $ = cheerio.load(pageHtml);
                                const ogImage = $('meta[property="og:image"]').attr('content');
                                if (ogImage) {
                                    thumbnailUrl = ogImage;
                                } else {
                                    console.warn(`No og:image found for ${link}`);
                                }
                            } else {
                                console.warn(`Failed to fetch page ${link}: ${pageResponse.status}`);
                            }
                        } catch (err) {
                            console.warn(`Thumbnail scrape කරන්න බැරි වුණා from ${link}: ${err.message}`);
                        }


                        await socket.sendMessage(sender, {
                            image: { url: thumbnailUrl },
                            caption: formatMessage(
                                '📰 SULA-MD GOSSIP නවතම පුවත් 📰',
                                `📢 *${title}*\n\n${desc}\n\n🕒 *Date*: ${date || 'තවම ලබාදීලා නැත'}\n🌐 *Link*: ${link}`,
                                '𝐒𝚄𝙻𝙰 𝐌𝙳 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃'
                            )
                        });
                    } catch (error) {
                        console.error(`Error in 'news' case: ${error.message}`);
                        await socket.sendMessage(sender, {
                            text: '⚠️ නිව්ස් ගන්න බැරි වුණා සුද්දෝ! 😩 යමක් වැරදුණා වගේ.'
                        });
                    }
                    break;
                case 'nasa':
                    try {
                        const response = await fetch('https://api.nasa.gov/planetary/apod?api_key=8vhAFhlLCDlRLzt5P1iLu2OOMkxtmScpO5VmZEjZ');
                        if (!response.ok) {
                            throw new Error('Failed to fetch APOD from NASA API');
                        }
                        const data = await response.json();

                        if (!data.title || !data.explanation || !data.date || !data.url || data.media_type !== 'image') {
                            throw new Error('Invalid APOD data received or media type is not an image');
                        }

                        const { title, explanation, date, url, copyright } = data;
                        const thumbnailUrl = url || 'https://via.placeholder.com/150';

                        await socket.sendMessage(sender, {
                            image: { url: thumbnailUrl },
                            caption: formatMessage(
                                '🌌 𝐒𝐔𝐋𝐀-𝐌𝐃 𝐍𝐀𝐒𝐀 𝐍𝐄𝐖𝐒',
                                `🌠 *${title}*\n\n${explanation.substring(0, 200)}...\n\n📆 *Date*: ${date}\n${copyright ? `📝 *Credit*: ${copyright}` : ''}\n🔗 *Link*: https://apod.nasa.gov/apod/astropix.html`,
                                '> 𝐒𝚄𝙻𝙰 𝐌𝙳 𝐌𝙸𝙽𝙸 𝐁𝙾𝚃'
                            )
                        });

                    } catch (error) {
                        console.error(`Error in 'apod' case: ${error.message}`);
                        await socket.sendMessage(sender, {
                            text: '⚠️ ඕවා බලන්න ඕනි නැ ගිහින් නිදාගන්න'
                        });
                    }
                    break;
                case 'cricket':
                    try {
                        console.log('Fetching cricket news from API...');
                        const response = await fetch('https://suhas-bro-api.vercel.app/news/cricbuzz');
                        console.log(`API Response Status: ${response.status}`);

                        if (!response.ok) {
                            throw new Error(`API request failed with status ${response.status}`);
                        }

                        const data = await response.json();
                        console.log('API Response Data:', JSON.stringify(data, null, 2));

                        if (!data.status || !data.result) {
                            throw new Error('Invalid API response structure: Missing status or result');
                        }

                        const { title, score, to_win, crr, link } = data.result;
                        if (!title || !score || !to_win || !crr || !link) {
                            throw new Error('Missing required fields in API response: ' + JSON.stringify(data.result));
                        }

                        console.log('Sending message to user...');
                        await socket.sendMessage(sender, {
                            text: formatMessage(
                                '🏏 POPKID-MD CRICKET NEWS🏏',
                                `📢 *${title}*\n\n` +
                                `🏆 *Mark*: ${score}\n` +
                                `🎯 *To Win*: ${to_win}\n` +
                                `📈 *Current Rate*: ${crr}\n\n` +
                                `🌐 *Link*: ${link}`,
                                'popkid md bot'
                            )
                        });
                        console.log('Message sent successfully.');
                    } catch (error) {
                        console.error(`Error in 'cricket' case: ${error.message}`);
                        await socket.sendMessage(sender, {
                            text: '⚠️ හා හා Cricket ඕනේ නෑ ගිහින් වෙන මොකක් හරි බලන්න.'
                        });
                    }
                    break;
                 
                
case /^song_(\d+)_quality$/i.test(msg.command) ? msg.command : false: {
    try {
        const args = msg.message?.conversation?.split(' ') || [];
        if (args.length < 2) return await socket.sendMessage(sender, { text: '*`Invalid command format`*' });

        const command = args[0]; // song_128_quality
        const yturl = args.slice(1).join(' '); // rest is URL
        const match = command.match(/^song_(\d+)_quality$/i);
        const quality = match ? parseInt(match[1]) : 128;

        await socket.sendMessage(sender, { text: `Fetching ${quality}kbps audio... ⏳` });

        const apiUrl = `https://api.id.dexter.it.com/download/youtube-audio?url=${encodeURIComponent(yturl)}&quality=${quality}`;
        const response = await fetch(apiUrl);
        const json = await response.json();

        if (!json?.success || !json.result?.result?.download?.status) {
            return await socket.sendMessage(sender, { text: '*`Failed to fetch audio`*' });
        }

        const downloadLink = json.result.result.download.url;
        const filename = json.result.result.download.filename;

        // Send the audio
        await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
        await socket.sendMessage(sender, {
            audio: { url: downloadLink },
            mimetype: "audio/mpeg",
            ptt: true,
            fileName: filename
        }, { quoted: msg });

        await socket.sendMessage(sender, { text: `✅ ${quality}kbps audio sent!` });

    } catch (err) {
        console.error(err);
        await socket.sendMessage(sender, { text: '*`Error occurred while downloading`*' });
    }
    break;
}

                case 'winfo':
                    console.log('winfo command triggered for:', number);
    if (!args[0]) {
        await socket.sendMessage(sender, {
            image: { url: config.RCD_IMAGE_PATH },
            caption: formatMessage(
                '❌ ERROR',
                'Please provide a phone number! Usage: .winfo +94xxxxxxxxx',
                'popkid md bot'
            )
        });
        break;
    }

    let inputNumber = args[0].replace(/[^0-9]/g, '');
    if (inputNumber.length < 10) {
        await socket.sendMessage(sender, {
            image: { url: config.RCD_IMAGE_PATH },
            caption: formatMessage(
                '❌ ERROR',
                'Invalid phone number! Please include country code (e.g., +254111385747)',
                '> popkid md bot'
            )
        });
        break;
    }

    let winfoJid = `${inputNumber}@s.whatsapp.net`;
    const [winfoUser] = await socket.onWhatsApp(winfoJid).catch(() => []);
    if (!winfoUser?.exists) {
        await socket.sendMessage(sender, {
            image: { url: config.RCD_IMAGE_PATH },
            caption: formatMessage(
                '❌ ERROR',
                'User not found on WhatsApp',
                '> popkid md bot'
            )
        });
        break;
    }

    let winfoPpUrl;
    try {
        winfoPpUrl = await socket.profilePictureUrl(winfoJid, 'image');
    } catch {
        winfoPpUrl = 'https://i.ibb.co/KhYC4FY/1221bc0bdd2354b42b293317ff2adbcf-icon.png';
    }

    let winfoName = winfoJid.split('@')[0];
    try {
        const presence = await socket.presenceSubscribe(winfoJid).catch(() => null);
        if (presence?.pushName) winfoName = presence.pushName;
    } catch (e) {
        console.log('Name fetch error:', e);
    }

    let winfoBio = 'No bio available';
    try {
        const statusData = await socket.fetchStatus(winfoJid).catch(() => null);
        if (statusData?.status) {
            winfoBio = `${statusData.status}\n└─ 📌 Updated: ${statusData.setAt ? new Date(statusData.setAt).toLocaleString('en-US', { timeZone: 'Asia/Colombo' }) : 'Unknown'}`;
        }
    } catch (e) {
        console.log('Bio fetch error:', e);
    }

    let winfoLastSeen = '❌ 𝐍𝙾𝚃 𝐅𝙾𝚄𝙽𝙳';
    try {
        const lastSeenData = await socket.fetchPresence(winfoJid).catch(() => null);
        if (lastSeenData?.lastSeen) {
            winfoLastSeen = `🕒 ${new Date(lastSeenData.lastSeen).toLocaleString('en-US', { timeZone: 'Asia/Colombo' })}`;
        }
    } catch (e) {
        console.log('Last seen fetch error:', e);
    }

    const userInfoWinfo = formatMessage(
        '🔍 PROFILE INFO',
        `> *Number:* ${winfoJid.replace(/@.+/, '')}\n\n> *Account Type:* ${winfoUser.isBusiness ? '💼 Business' : '👤 Personal'}\n\n*📝 About:*\n${winfoBio}\n\n*🕒 Last Seen:* ${winfoLastSeen}`,
        '> popkid md bot'
    );

    await socket.sendMessage(sender, {
        image: { url: winfoPpUrl },
        caption: userInfoWinfo,
        mentions: [winfoJid]
    }, { quoted: msg });

    console.log('User profile sent successfully for .winfo');
    break;



case 'ig': {
    const axios = require('axios');
    const { igdl } = require('ruhend-scraper');

    const q = msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        '';

    const igUrl = q?.trim();

    if (!/instagram\.com/.test(igUrl)) {
        return await socket.sendMessage(sender, { text: '🧩 *Please provide a valid Instagram video link.*' });
    }

    try {
        await socket.sendMessage(sender, { react: { text: '⬇', key: msg.key } });

        const res = await igdl(igUrl);
        const data = res.data;

        if (data && data.length > 0) {
            const videoUrl = data[0].url;

            await socket.sendMessage(sender, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption: '> popkid md bot'
            }, { quoted: msg });

            await socket.sendMessage(sender, { react: { text: '✔', key: msg.key } });
        } else {
            await socket.sendMessage(sender, { text: '*❌ No video found in the provided link.*' });
        }

    } catch (e) {
        console.log(e);
        await socket.sendMessage(sender, { text: '*❌ Error downloading Instagram video.*' });
    }

    break;
}

                case 'deleteme':
                    const sessionPath = path.join(SESSION_BASE_PATH, `session_${number.replace(/[^0-9]/g, '')}`);
                    if (fs.existsSync(sessionPath)) {
                        fs.removeSync(sessionPath);
                    }
                    await deleteSessionFromDB(number);
                    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
                        activeSockets.get(number.replace(/[^0-9]/g, '')).ws.close();
                        activeSockets.delete(number.replace(/[^0-9]/g, ''));
                        socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
                    }
                    await socket.sendMessage(sender, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '🗑️ SESSION DELETED',
                            '✅ Your session has been successfully deleted.',
                            'popkid md bot'
                        )
                    });
                    break;
                // © 𝚂𝚄𝙻𝙰-𝙼𝙳
                case "setting": {
                    try {
                        if (!isOwner) {
                            return await reply("🚫 *You are not authorized to use this command!*");
                        }

                        const settingOptions = {
                            name: 'single_select',
                            paramsJson: JSON.stringify({
                                title: '🔧 popkid md bot',
                                sections: [
                                    {
                                        title: '➤ 𝐖𝙾𝚁𝙺 𝐓𝚈𝙿𝙴',
                                        rows: [
                                            { title: '𝐏𝚄𝙱𝙻𝙸𝙲', description: '', id: `${prefix}wtype public` },
                                            { title: '𝐎𝙽𝙻𝚈 𝐆𝚁𝙾𝚄𝙿', description: '', id: `${prefix}wtype groups` },
                                            { title: '𝐎𝙽𝙻𝚈 𝙸𝙽𝙱𝙾𝚇', description: '', id: `${prefix}wtype inbox` },
                                            { title: '𝐎𝙽𝙻𝚈 𝐏𝚁𝙸𝚅𝙰𝚃𝙴', description: '', id: `${prefix}wtype private` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐅𝙰𝙺𝙴 𝐑𝙴𝙲𝙾𝙳𝙸𝙽𝙶 & 𝐓𝚈𝙿𝙴𝙸𝙽𝙶',
                                        rows: [
                                            { title: '𝐀𝚄𝚃𝙾 𝐓𝚈𝙿𝙸𝙽𝙶', description: '', id: `${prefix}wapres composing` },
                                            { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙲𝙾𝙳𝙸𝙽𝙶', description: '', id: `${prefix}wapres recording` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝐔𝐓𝐎 𝐑𝐄𝐏𝐋𝐘 𝐌𝐎𝐃𝐄',
                                        rows: [
                                            { title: '𝐀𝚄𝚃𝙾 𝐑𝐄𝐏𝐋𝐘 𝐎𝐍 ⚡', description: '', id: `${prefix}autoreply on` },
                                            { title: '𝐀𝚄𝚃𝙾 𝐑𝐄𝐏𝐋𝐘 𝐎𝐅𝐅 ⚡', description: '', id: `${prefix}autoreply off` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝙻𝙻𝚆𝙰𝚈𝚂 𝐎𝙽𝙻𝙸𝙽𝙴',
                                        rows: [
                                            { title: '𝐀𝙻𝙻𝚆𝙰𝚈𝚂 𝐎𝙽𝙻𝙸𝙽𝙴 𝐎𝙵𝙵', description: '', id: `${prefix}wapres unavailable` },
                                            { title: '𝐀𝙻𝙻𝚆𝙰𝚈𝚂 𝐎𝙽𝙻𝙸𝙽𝙴 𝐎𝙽', description: '', id: `${prefix}wapres available` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝚄𝚃𝙾 𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽',
                                        rows: [
                                            { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽 𝐎𝙽', description: '', id: `${prefix}rstatus on` },
                                            { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽 𝐎𝙵𝙵', description: '', id: `${prefix}rstatus off` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝚄𝚃𝙾 𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃',
                                        rows: [
                                            { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃 𝐎𝙽', description: '', id: `${prefix}arm on` },
                                            { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃 𝐎𝙵𝙵', description: '', id: `${prefix}arm off` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲𝚃 𝐂𝙰𝙻𝙻',
                                        rows: [
                                            { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲𝚃 𝐂𝙰𝙻𝙻 𝐎𝙽', description: '', id: `${prefix}creject on` },
                                            { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲𝚃 𝐂𝙰𝙻𝙻 𝐎𝙵𝙵', description: '', id: `${prefix}creject off` },
                                        ],
                                    },
                                    {
                                        title: '➤ 𝐀𝚄𝚃𝙾 𝐌𝙰𝚂𝚂𝙰𝙶𝙴 𝐑𝙴𝙰𝙳',
                                        rows: [
                                            { title: '𝐑𝙴𝙰𝙳 𝐀𝙻𝙻 𝐌𝙰𝚂𝚂𝙰𝙶𝙴', description: '', id: `${prefix}mread all` },
                                            { title: '𝐑𝙴𝙰𝙳 𝐀𝙻𝙻 𝐌𝙰𝚂𝚂𝙰𝙶𝙴 𝐂𝙾𝙼𝙼𝙰𝙽𝙳𝚂', description: '', id: `${prefix}mread cmd` },
                                            { title: '𝐃𝙾𝙽𝚃 𝐑𝙴𝙰𝙳 𝐀𝙽𝚈 𝐌𝙰𝚂𝚂𝙰𝙶𝙴', description: '', id: `${prefix}mread off` },
                                        ],
                                    },
                                ],
                            }),
                        };

                        await socket.sendMessage(msg.key.remoteJid, {
                            headerType: 1,
                            viewOnce: true,
                            image: { url: config.RCD_IMAGE_PATH },
                            caption: `╭────────────╮\nPOPKID MD SETTINGS\n╰────────────╯\n\n` +
                                `┏━━━━━━━━━━◆◉◉➤` +
                                `┃◉ *WORK TYPE:* ${config.WORK_TYPE}\n` +
                                `┃◉ *AUTO REPLY:* ${config.AUTO_REPLY}\n` +
                                `┃◉ *BOT PRESENCE:* ${config.PRESENCE}\n` +
                                `┃◉ *AUTO STATUS SEEN:* ${config.AUTO_VIEW_STATUS}\n` +
                                `┃◉ *AUTO STATUS REACT:* ${config.AUTO_REACT_STATUS}\n` +
                                `┃◉ *AUTO REJECT CALL:* ${config.ANTI_CALL}\n` +
                                `┃◉ *AUTO MESSAGE READ :* ${config.AUTO_READ_MESSAGE}\n` +
                                `┗━━━━━━━━━━◆◉◉➤`,
                            buttons: [
                                {
                                    buttonId: 'settings_action',
                                    buttonText: { displayText: '⚙️ Configure Settings' },
                                    type: 4,
                                    nativeFlowInfo: settingOptions,
                                },
                            ],
                            footer: config.CAPTION,
                        }, { quoted: msg });
                    } catch (e) {
                        reply("*❌ Error !!*");
                        console.log(e);
                    }
                    break;
                }
                case "wtype": {

                    await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            groups: "groups",
                            inbox: "inbox",
                            private: "private",
                            public: "public"
                        };
                        if (settings[q]) {
                            await updateSetting("WORK_TYPE", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
                case "wapres": {

                    await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            composing: "composing",
                            recording: "recording",
                            available: "available",
                            unavailable: "unavailable"
                        };
                        if (settings[q]) {
                            await updateSetting("PRESENCE", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
                case "rstatus": {

                    await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            on: "true",
                            off: "false"
                        };
                        if (settings[q]) {
                            await updateSetting("AUTO_VIEW_STATUS", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
case "imginfo": {
    const axios = require("axios");
    const FormData = require("form-data");
    const crypto = require("crypto");

    const prompt = args.join(" ").trim();
    if (!prompt) {
        return socket.sendMessage(sender, {
            text: "⚠️ *Image එකකට reply කරලා ප්‍රශ්නයක් දාන්න*\n\nExample:\n.imginfo මෙම චිත්‍රයේ ගැටළු වල උත්තර දෙන්න"
        }, { quoted: msg });
    }

    const mediaMsg =
        msg.message?.imageMessage
            ? msg
            : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
                : null;

    if (!mediaMsg) {
        return socket.sendMessage(sender, {
            text: "❌ *Image එකකට reply කරන්න!*"
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });

        /* 📥 Download image */
        const stream = await downloadContentFromMessage(
            mediaMsg.message.imageMessage,
            "image"
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const filename = crypto.randomBytes(6).toString("hex") + ".jpg";
        let imageUrl = "";
        let uploadedVia = "";

        /* =========================
           🟩 ImgBB (PRIMARY)
        ========================= */
        try {
            const form = new FormData();
            form.append("image", buffer.toString("base64"));
            form.append("name", filename);

            const res = await axios.post(
                "https://api.imgbb.com/1/upload?key=4cded2c59cbfdd16c02b3f28c4e38e0b",
                form,
                { headers: form.getHeaders(), timeout: 20000 }
            );

            if (res.data?.success && res.data?.data?.url) {
                imageUrl = res.data.data.url;
                uploadedVia = "ImgBB";
            }
        } catch (e) {
            console.log("ImgBB upload failed");
        }

        /* =========================
           🟥 Catbox (FALLBACK)
        ========================= */
        if (!imageUrl) {
            try {
                const form = new FormData();
                form.append("reqtype", "fileupload");
                form.append("fileToUpload", buffer, filename);

                const res = await axios.post(
                    "https://catbox.moe/user/api.php",
                    form,
                    {
                        headers: form.getHeaders(),
                        responseType: "text",
                        timeout: 20000
                    }
                );

                if (typeof res.data === "string" && res.data.startsWith("https://")) {
                    imageUrl = res.data.trim();
                    uploadedVia = "Catbox";
                }
            } catch (e) {
                console.log("Catbox upload failed");
            }
        }

        if (!imageUrl) {
            throw new Error("All uploaders failed");
        }

        console.log("Image uploaded via:", uploadedVia);

        /* =========================
           🤖 GPT (4.1 ➜ 5 fallback)
        ========================= */
        let answer = "";

        try {
            const api1 =
                "https://api.nekolabs.web.id/text-generation/gpt/4.1-nano" +
                `?text=${encodeURIComponent(prompt)}` +
                `&systemPrompt=iam+dexter` +
                `&imageUrl=${encodeURIComponent(imageUrl)}` +
                `&sessionId=neko`;

            const res1 = await axios.get(api1, { timeout: 30000 });
            if (!res1.data?.success) throw new Error();
            answer = res1.data.result;
        } catch {
            const api2 =
                "https://api.nekolabs.web.id/text-generation/gpt/5-nano" +
                `?text=${encodeURIComponent(prompt)}` +
                `&systemPrompt=iam+dexter` +
                `&imageUrl=${encodeURIComponent(imageUrl)}` +
                `&sessionId=neko`;

            const res2 = await axios.get(api2, { timeout: 30000 });
            answer = res2.data.result;
        }

        /* =========================
           📤 Send clean answer only
        ========================= */
        const finalMsg =
`✨ *Answer*

${answer}

📤 Uploaded via: ${uploadedVia}
> Powered by popkid🤍`;

        await socket.sendMessage(sender, { text: finalMsg }, { quoted: msg });
        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("IMGINFO ERROR:", err.message);

        await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
        await socket.sendMessage(sender, {
            text: "❌ *Image upload / analysis failed*"
        }, { quoted: msg });
    }

    break;
}
case "removebg": {
    const axios = require("axios");
    const FormData = require("form-data");
    const crypto = require("crypto");

    const mediaMsg =
        msg.message?.imageMessage
            ? msg
            : msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
                ? { ...msg, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
                : null;

    if (!mediaMsg) {
        return socket.sendMessage(sender, {
            text: "❌ *Image එකකට reply කරලා `.removebg` කියලා type කරන්න*"
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, {
            react: { text: "⏳", key: msg.key }
        });

        /* 📥 Download image */
        const stream = await downloadContentFromMessage(
            mediaMsg.message.imageMessage,
            "image"
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        const ext =
            mediaMsg.message.imageMessage.mimetype?.split("/")[1] || "jpg";

        const filename = crypto.randomBytes(6).toString("hex") + "." + ext;

        /* =========================
           📤 Upload to CATBOX
        ========================= */
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, filename);

        const upload = await axios.post(
            "https://catbox.moe/user/api.php",
            form,
            {
                headers: form.getHeaders(),
                responseType: "text",
                timeout: 30000
            }
        );

        if (!upload.data || !upload.data.startsWith("https://")) {
            throw new Error("Catbox upload failed");
        }

        const imageUrl = upload.data.trim();

        /* =========================
           ✂️ RemoveBG API
        ========================= */
        const api =
            "https://api.zenitsu.web.id/api/tools/removebg" +
            `?imageUrl=${encodeURIComponent(imageUrl)}`;

        const result = await axios.get(api, {
            responseType: "arraybuffer",
            timeout: 30000
        });

        const outputBuffer = Buffer.from(result.data);

        /* =========================
           📤 Send Result
        ========================= */
        await socket.sendMessage(sender, {
            image: outputBuffer,
            caption:
`🖼️ *Background Removed Successfully*

🔗 Source (Catbox):
${imageUrl}

> Powered by popkid 🤍`
        }, { quoted: msg });

        await socket.sendMessage(sender, {
            react: { text: "✅", key: msg.key }
        });

    } catch (err) {
        console.error("REMOVEBG ERROR:", err.message);

        await socket.sendMessage(sender, {
            react: { text: "❌", key: msg.key }
        });

        await socket.sendMessage(sender, {
            text: "❌ *Background remove failed (Catbox / API error)*"
        }, { quoted: msg });
    }

    break;
}
case "xnxx": {
    const axios = require("axios");

    const rawText = msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.buttonsResponseMessage?.selectedButtonId ||
                    msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;

    const parts = rawText.trim().split(/\s+/);
    const quality = parts[1]?.toLowerCase(); // high / low
    const videoUrl = parts[2];

    if (!quality || !["high","low"].includes(quality) || !videoUrl) {
        return socket.sendMessage(sender, {
            text: "❌ *Usage:*\n.xnxx high <video_url>\n.xnxx low <video_url>"
        }, { quoted: msg });
    }

    try {
        await socket.sendMessage(sender, { react: { text: "⏳", key: msg.key } });
        const apiUrl = `https://api.zenitsu.web.id/api/download/xnxx?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(apiUrl, { timeout: 30000 });

        if (!res.data || !res.data.results || !res.data.results.files) {
            throw new Error("Video not found or API error");
        }

        const result = res.data.results;
        const downloadLink = result.files[quality];
        const thumbnailUrl = result.image;
        const infoText = `🎬 *Title:* ${result.title}\n⏱️ Duration: ${result.duration} sec\n📄 Info: ${result.info}\n🎚️ Quality: ${quality.toUpperCase()}`;

        // 🔥 Download thumbnail as buffer
        let thumbnailBuffer;
        if (thumbnailUrl) {
            const thumbRes = await axios.get(thumbnailUrl, { responseType: "arraybuffer" });
            thumbnailBuffer = Buffer.from(thumbRes.data);
        }

        await socket.sendMessage(sender, {
            video: { url: downloadLink },
            caption: infoText,
            jpegThumbnail: thumbnailBuffer
        }, { quoted: msg });

        await socket.sendMessage(sender, { react: { text: "✅", key: msg.key } });

    } catch (err) {
        console.error("XNXX ERROR:", err.message);
        await socket.sendMessage(sender, { react: { text: "❌", key: msg.key } });
        await socket.sendMessage(sender, {
            text: "❌ *Video download failed or invalid URL*"
        }, { quoted: msg });
    }

    break;
}
                case "creject": {

                    await socket.sendMessage(sender, { react: { text: '🧛‍♂️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            on: "on",
                            off: "off",
                        };
                        if (settings[q]) {
                            await updateSetting("ANTI_CALL", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
                case 'resetconfig': {
    if (!isOwner) {
        return await socket.sendMessage(sender, { 
            text: '🚫 Only the owner can reset config!' 
        }, { quoted: msg });
    }

    try {
        const sanitized = number.replace(/[^0-9]/g, '');

        // Reset config to default in DB
        await saveDefaultConfigToDB(sanitized);

        // Update in-memory cache (if you added configCache)
        if (typeof configCache !== 'undefined' && configCache.has(sanitized)) {
            configCache.set(sanitized, { ...defaultConfigs });
        }

        // Apply default config immediately
        Object.assign(config, { ...defaultConfigs });

        // Clear custom auto-reply triggers
        await pool.query(
            'DELETE FROM custom_auto_reply_triggers WHERE phone_number = $1',
            [sanitized]
        );

        // Clear autopost settings
        await pool.query(
            'DELETE FROM autopost_settings WHERE phone_number = $1',
            [sanitized]
        );

        // Clear autopost interval if running
        if (autopostIntervals.has(sanitized)) {
            clearInterval(autopostIntervals.get(sanitized));
            autopostIntervals.delete(sanitized);
        }

        await socket.sendMessage(sender, {
            text:
`✅ *Config Reset Completed!*

📌 All bot settings restored to default
📌 Custom auto-replies cleared
📌 Autopost settings cleared
📌 Session & credentials unchanged

Bot is now running with default configuration.
Type .menu to see commands.`
        }, { quoted: msg });

    } catch (err) {
        console.error('Reset config error:', err);
        await socket.sendMessage(sender, {
            text: '❌ Failed to reset config. Check logs.'
        }, { quoted: msg });
    }
    break;
}
                case "arm": {

                    await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            on: "true",
                            off: "false",
                        };
                        if (settings[q]) {
                            await updateSetting("AUTO_LIKE_STATUS", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
                case "mread": {

                    await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        let q = args[0];
                        const settings = {
                            all: "all",
                            cmd: "cmd",
                            off: "off"
                        };
                        if (settings[q]) {
                            await updateSetting("AUTO_READ_MESSAGE", settings[q], reply, number);
                        }
                    } catch (e) {
                        console.log(e);
                        reply(`${e}`);
                    }
                    break;
                }
                case "restart": {
                    await socket.sendMessage(sender, { react: { text: '🔄', key: msg.key } });
                    try {
                        if (!isOwner)
                            return await reply("🚫 *You are not authorized to use this command!*");
                        
                        await reply("🔄 *Restarting bot...*");
                        await restartBot(socket, number);
                    } catch (e) {
                        console.log(e);
                        reply(`❌ Error restarting bot: ${e}`);
                    }
                    break;
                }
                case "autoreply": {
                    await handleAutoReplyCommand(
                        socket,
                        msg,
                        sender,
                        number,
                        args,
                        isOwner,
                        pool,
                        prefix
                    );
                    break;
                }
            }
        } catch (error) {
            console.error('Command handler error:', error);
            // Ensure variables are defined before using them in the catch block
            if (sender && msg) {
                await socket.sendMessage(sender, {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage(
                        '❌ ERROR',
                        'An error occurred while processing your command. Please try again.',
                        'popkid md bot'
                    )
                });
            }
        }
        if (!isCmd && body && sender && msg) {
            await handleAutoReply(
                socket,
                msg,
                sender,
                number,
                isOwner,
                pool
            );
        }
    });
}

function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (config.AUTO_RECORDING === 'true') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

async function setupcallhandlers(socket, number) {
    socket.ev.on('call', async (calls) => {
        try {
            await loadConfig(number).catch(console.error);
            if (config.ANTI_CALL === 'off') return;

            for (const call of calls) {
                if (call.status !== 'offer') continue;

                const id = call.id;
                const from = call.from;

                await socket.rejectCall(id, from);
                await socket.sendMessage(from, {
                    text: '*🔕 Your call was automatically rejected..!*\n*📵 The owner is currently busy. Please try again later.. 💤*'
                });
            }
        } catch (err) {
            console.error("Anti-call error:", err);
        }
    });
}

async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const sessionData = await getSessionFromDB(sanitizedNumber);
        
        if (sessionData) {
            return sessionData;
        }
        
        return null;
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// © 𝚂𝚄𝙻𝙰-𝙼𝙳
async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configData = await getConfigFromDB(sanitizedNumber);
        
        if (configData) {
            return configData;
        }
        
        // If no config exists, save default config and return it
        await saveDefaultConfigToDB(sanitizedNumber);
        return { ...defaultConfigs };
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...defaultConfigs };
    }
}

async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        await saveConfigToDB(sanitizedNumber, newConfig);
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}
function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const sanitizedNumber = number.replace(/[^0-9]/g, '');

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode 
                || lastDisconnect?.error?.output?.payload?.statusCode 
                || 'unknown';

            console.log(`🔌 Connection closed for ${number} (code: ${statusCode})`);

            // 🔥 CASE 1: Permanent logout (401) – another device login / manual logout
            if (statusCode === 401) {
                console.log(`🚫 Permanent logout detected for ${number} – cleaning session permanently`);

                // Clear autopost interval first
                if (autopostIntervals.has(sanitizedNumber)) {
                    clearInterval(autopostIntervals.get(sanitizedNumber));
                    autopostIntervals.delete(sanitizedNumber);
                    console.log(`🛑 Autopost stopped for ${number}`);
                }

                // Remove from active maps
                if (activeSockets.has(sanitizedNumber)) {
                    try {
                        activeSockets.get(sanitizedNumber).ws.close();
                        activeSockets.get(sanitizedNumber).end();
                    } catch (e) {}
                    activeSockets.delete(sanitizedNumber);
                }
                socketCreationTime.delete(sanitizedNumber);

                // Delete session from database
                await deleteSessionFromDB(number).catch(console.error);

                // Delete local session folder
                const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);
                if (fs.existsSync(sessionPath)) {
                    fs.removeSync(sessionPath);
                    console.log(`🗑️ Deleted local session folder: ${sessionPath}`);
                }

                // Notify user (if socket still partially alive)
                try {
                    const userJid = jidNormalizedUser(socket.user?.id || `${sanitizedNumber}@s.whatsapp.net`);
                    await socket.sendMessage(userJid, {
                        image: { url: config.RCD_IMAGE_PATH },
                        caption: formatMessage(
                            '🔓 SESSION EXPIRED',
                            'ඔයාගේ WhatsApp account එක අනිත් device එකකින් login වුණා හෝ manually logout කළා.\n\n' +
                            '📌 All settings & config preserved වෙලා තියෙනවා.\n' +
                            '🔄 නැවත connect කරන්න `.pair` command එක use කරන්න (අලුත් pairing code එකක් එයි).',
                            'popkid md bot'
                        )
                    });
                } catch (err) {
                    console.warn(`⚠️ Could not send logout notification to ${number}`);
                }

                console.log(`✅ Permanent logout handled. Waiting for fresh pairing.`);
                return; // 🔥 NO RECONNECT
            }

            // 🔥 CASE 2: Restart required (515) – common after first pairing
            if (statusCode === 515) {
                console.log(`🔄 Restart required (515) for ${number} – recreating fresh socket`);
                await delay(5000);

                if (autopostIntervals.has(sanitizedNumber)) {
                    clearInterval(autopostIntervals.get(sanitizedNumber));
                    autopostIntervals.delete(sanitizedNumber);
                }
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);

                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                return;
            }

            // 🔥 CASE 3: Temporary disconnects (408, 428, network issues, etc.)
            if ([408, 428, 429, 500].includes(statusCode) || statusCode === 'unknown') {
                console.log(`📡 Temporary disconnect (code: ${statusCode}) – reconnecting in 10s...`);

                // Clean old references
                if (autopostIntervals.has(sanitizedNumber)) {
                    clearInterval(autopostIntervals.get(sanitizedNumber));
                    autopostIntervals.delete(sanitizedNumber);
                }
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);

                await delay(10000);

                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                return;
            }

            // 🔥 DEFAULT: Any other error – safe reconnect
            console.log(`🔄 Unknown disconnect (code: ${statusCode}) – safe reconnect in 5s...`);
            await delay(5000);

            if (autopostIntervals.has(sanitizedNumber)) {
                clearInterval(autopostIntervals.get(sanitizedNumber));
                autopostIntervals.delete(sanitizedNumber);
            }
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }

        // Optional: Log when connection opens
        if (connection === 'open') {
            console.log(`✅ Connection opened successfully for ${number}`);
        }
    });
}   
const lastCredsHash = new Map(); // Important creds hash per number

const cron = require('node-cron');
cron.schedule('0 0 * * *', async () => {  
    console.log('🕛 Daily midnight session backup started for all bots');
    for (const [number, socket] of activeSockets.entries()) {
        try {
            // Force save local creds first
            if (socket.authState?.saveCreds) await socket.authState.saveCreds();

            const credsPath = path.join(SESSION_BASE_PATH, `session_${number}`, 'creds.json');
            if (fs.existsSync(credsPath)) {
                const data = JSON.parse(await fs.readFile(credsPath, 'utf8'));
                await saveSessionToDB(number, data);
                console.log(`🕛 Daily backup saved: ${number}`);
            }
        } catch (err) {
            console.error(`🕛 Daily backup failed for ${number}:`, err.message);
        }
    }
    console.log('🕛 Daily midnight backup completed');
});
console.log('🕛 Midnight backup cron scheduled');
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    // 1. Restore session from DB
    let restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`✅ Session restored from DB: ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    let socket;
    try {
        socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari'),
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 20000,
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        activeSockets.set(sanitizedNumber, socket);

        // Setup handlers
        await connectdb(sanitizedNumber);
        setupcallhandlers(socket, sanitizedNumber);
        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        // Pairing code
        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES || 5;
            let code = null;

            while (retries > 0 && !code) {
                try {
                    await delay(2000);
                    code = await socket.requestPairingCode(sanitizedNumber);
                } catch (err) {
                    retries--;
                    console.warn(`⚠️ Pairing code retry (${retries} left): ${err.message}`);
                    await delay(3000);
                }
            }

            if (code && !res.headersSent) {
                res.json({ code });
                return;
            } else if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate pairing code' });
                return;
            }
        }

        // Connection update
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed: ${sanitizedNumber} | Reconnect: ${shouldReconnect}`);

                if (!shouldReconnect) {
                    console.log(`Permanently logged out: ${sanitizedNumber}`);
                    activeSockets.delete(sanitizedNumber);
                } else {
                    setTimeout(() => {
                        exec(`pm2 restart ${process.env.PM2_NAME || 'SULA-MINI-main'}`, (err) => {
                            if (err) console.error('PM2 restart error:', err);
                        });
                    }, 5000);
                }
            }
if (connection === 'open') {
    console.log(`✅ WhatsApp connected: ${sanitizedNumber}`);

    try {
        await delay(3000);
        const userJid = jidNormalizedUser(socket.user.id);

        // === LOAD & SYNC FULL CACHE FROM PG ONCE ===
const cacheModule = require('./cache.js');
       await cacheModule.loadCache(); // ensures objects exist
await cacheModule.syncFromPG();
        console.log(`✅ Full local cache synced from PostgreSQL`);

const userConfig = cacheModule.getConfig(sanitizedNumber);
Object.assign(config, userConfig);
        console.log(`✅ Current bot config loaded: WORK_TYPE=${config.WORK_TYPE}, PREFIX=${config.PREFIX}`);

        // Join group
        const groupResult = await joinGroup(socket);

        // Auto follow newsletters
        try {
            const newsletterList = await loadNewsletterJIDsFromRaw();
            for (const jid of newsletterList) {
                try {
                    await socket.newsletterFollow(jid);
                } catch (e) {
                    console.warn(`Failed to follow newsletter ${jid}: ${e.message}`);
                }
            }
            console.log(`✅ Auto-followed ${newsletterList.length} newsletters`);
        } catch (e) {
            console.error('Newsletter follow error:', e.message);
        }

        // Autopost interval setup
        if (autopostIntervals.has(sanitizedNumber)) {
            clearInterval(autopostIntervals.get(sanitizedNumber));
            console.log(`🧹 Cleared old autopost interval for ${sanitizedNumber}`);
        }

        const autopostData = cacheModule.getAutopost(sanitizedNumber);
        if (Object.keys(autopostData).length > 0) {
            const interval = setInterval(() => checkAndPostAutopost(socket, sanitizedNumber), 60000);
            autopostIntervals.set(sanitizedNumber, interval);
            console.log(`🔄 Autopost interval started for ${sanitizedNumber} (${Object.keys(autopostData).join(', ')})`);
        } else {
            console.log(`ℹ️ No autopost configured for ${sanitizedNumber}`);
        }

        // Welcome message
        const welcomeMessage = formatMessage(
            '👻 *POPKID MD BOT* 👻',
            `✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n\n` +
            `┃◉ Work Type: ${config.WORK_TYPE}\n` +
            `┃◉ Prefix: ${config.PREFIX}\n` +
            `┃◉ Auto Reply: ${config.AUTO_REPLY}\n` +
            `📢 𝐎𝚄𝚁 𝐂𝙷𝙰𝙽𝙽𝙴𝙻 \n> https://whatsapp.com/channel/0029Vb70ySJHbFV91PNKuL3T`,
            'popkid md bot'
        );

        await socket.sendMessage(userJid, {
            image: { url: config.RCD_IMAGE_PATH },
            caption: welcomeMessage
        });

        // Notify admins
        await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

        // Add to numbers table if not exists
        await ensureNumberInDB(sanitizedNumber);

        // Final backup of creds (safety)
        try {
            await saveCreds();
            const credsPath = path.join(sessionPath, 'creds.json');
            const data = JSON.parse(await fs.readFile(credsPath, 'utf8'));
            await saveSessionToDB(sanitizedNumber, data);
            console.log(`✅ Session backed up to DB after full setup`);
        } catch (e) {
            console.warn(`Creds backup failed (non-critical): ${e.message}`);
        }

        console.log(`🚀 Bot fully ready with cached data: ${sanitizedNumber}`);

    } catch (err) {
        console.error(`❌ Setup error after connect (${sanitizedNumber}):`, err.message);
        console.error(err.stack);
    }
            }
        });

    } catch (error) {
        console.error(`Critical error in EmpirePair (${sanitizedNumber}):`, error.message);
        socketCreationTime.delete(sanitizedNumber);
        activeSockets.delete(sanitizedNumber);

        if (!res.headersSent) {
            res.status(503).json({ error: 'Service unavailable. Try again later.' });
        }
    }
}
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: '👻 popkid md bot running',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromDB();
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const numbers = await getAllNumbersFromDB();
        
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No session files found in database' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});
const reactionHistory = new Map(); 
router.get('/react-all', async (req, res) => {
    const { link, emojis } = req.query;
    
    if (!link || !emojis) {
        return res.status(400).send({ 
            error: 'Channel link and emoji list are required',
            usage: '/react-all?link=<channel_message_link>&emojis=<emoji1,emoji2,emoji3>',
            example: '/react-all?link=https://whatsapp.com/channel/1234/5678&emojis=💖,😘,😍,🥰,💞'
        });
    }
    const parts = link.split('/');
    const channelId = parts[4];
    const messageId = parts[5];
    
    if (!channelId || !messageId) {
        return res.status(400).send({
            error: 'Invalid channel link format',
            format: 'https://whatsapp.com/channel/<channel_id>/<message_id>'
        });
    }
    const emojiArray = emojis.split(',').map(e => e.trim());
    if (emojiArray.length === 0) {
        return res.status(400).send({
            error: 'At least one emoji is required'
        });
    }
    
    const activeNumbers = Array.from(activeSockets.keys());
    
    if (activeNumbers.length === 0) {
        return res.status(404).send({
            error: 'No active bots found'
        });
    }
    const messageKey = `${channelId}_${messageId}`;
    const availableBots = activeNumbers.filter(number => {
        const botHistory = reactionHistory.get(number) || [];
        return !botHistory.includes(messageKey);
    });
    
    if (availableBots.length === 0) {
        return res.status(200).send({
            status: 'completed',
            message: 'All bots have already reacted to this message',
            alreadyReacted: activeNumbers.length,
            newReactions: 0
        });
    }
    console.log(`🚀 Starting reaction process for ${availableBots.length} available bots on channel ${channelId}`);
    console.log(`📊 Total active bots: ${activeNumbers.length}, Already reacted: ${activeNumbers.length - availableBots.length}`);
    const reactionPromises = [];
    const results = [];
    const maxDelay = 15000; 
    const delayPerBot = Math.floor(maxDelay / availableBots.length);
    
    for (let i = 0; i < availableBots.length; i++) {
        const number = availableBots[i];
        const socket = activeSockets.get(number);
        
        if (!socket) continue;
        const randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
        const reactionPromise = new Promise(async (resolve) => {
            try {
                setTimeout(async () => {
                    try {
                        const metadata = await socket.newsletterMetadata("invite", channelId);
                        
                        await socket.newsletterReactMessage(metadata.id, messageId, randomEmoji);
                        const botHistory = reactionHistory.get(number) || [];
                        botHistory.push(messageKey);
                        reactionHistory.set(number, botHistory);
                        
                        console.log(`✅ Bot ${number} reacted with ${randomEmoji} to message ${messageId}`);
                        results.push({
                            number,
                            status: 'success',
                            emoji: randomEmoji
                        });
                        resolve();
                    } catch (error) {
                        console.error(`❌ Bot ${number} failed to react:`, error.message);
                        results.push({
                            number,
                            status: 'failed',
                            error: error.message
                        });
                        resolve();
                    }
                }, i * delayPerBot);
            } catch (error) {
                console.error(`❌ Bot ${number} setup failed:`, error.message);
                results.push({
                    number,
                    status: 'failed',
                    error: error.message
                });
                resolve();
            }
        });
        
        reactionPromises.push(reactionPromise);
    }
    const timeoutPromise = new Promise(resolve => {
        setTimeout(resolve, 20000);
    });
    
    await Promise.race([
        Promise.all(reactionPromises),
        timeoutPromise
    ]);
    
    const successCount = results.filter(r => r.status === 'success').length;
    const alreadyReactedCount = activeNumbers.length - availableBots.length;
    
    console.log(`🎉 Reaction process completed: ${successCount}/${availableBots.length} new reactions, ${alreadyReactedCount} bots already reacted`);
    res.status(200).send({
        status: 'completed',
        message: `${successCount} bots reacted successfully to the channel message`,
        alreadyReacted: alreadyReactedCount,
        newReactions: successCount,
        totalActive: activeNumbers.length
    });
});
router.get('/clear-reaction-history', async (req, res) => {
    const { number, messageId } = req.query;
    
    if (number && messageId) {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const botHistory = reactionHistory.get(sanitizedNumber) || [];
        const updatedHistory = botHistory.filter(key => key !== messageId);
        reactionHistory.set(sanitizedNumber, updatedHistory);
        
        res.status(200).send({
            status: 'success',
            message: `Cleared reaction history for bot ${sanitizedNumber} on message ${messageId}`
        });
    } else if (number) {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        reactionHistory.delete(sanitizedNumber);
        
        res.status(200).send({
            status: 'success',
            message: `Cleared all reaction history for bot ${sanitizedNumber}`
        });
    } else {
        reactionHistory.clear();
        
        res.status(200).send({
            status: 'success',
            message: 'Cleared all reaction history'
        });
    }
});
router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.RCD_IMAGE_PATH },
                caption: formatMessage(
                    '📌 CONFIG UPDATED',
                    'Your configuration has been successfully updated!',
                    'popkid md bot'
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// © 𝚂𝚄𝙻𝙰-𝙼𝙳
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'SULA-MINI-main'}`);
});

async function autoReconnectFromDB() {
    try {
        const numbers = await getAllNumbersFromDB();

        for (const number of numbers) {
            if (!activeSockets.has(number)) {
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
                await EmpirePair(number, mockRes);
                console.log(`🔁 Reconnected from database: ${number}`);
                await delay(5000);
            }
        }
    } catch (error) {
        console.error('❌ autoReconnectFromDB error:', error.message);
    }
}

autoReconnectFromDB();

module.exports = router;

async function loadNewsletterJIDsFromRaw() {
    try {
        const res = await axios.get('https://raw.githubusercontent.com/DEXTER-ID-KING/DATABASE-SAVE/refs/heads/main/channel.json'); //ඔයාගේ 𝚓𝚜𝚘𝚗 එකක් හදලා දාගන්න 
        return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
        console.error('❌ Failed to load newsletter list from GitHub:', err.message);
        return [];
    }
                         }
