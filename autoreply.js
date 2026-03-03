const axios = require('axios');
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require('path');
const fs = require('fs-extra');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Temp folder for mp3->opus conversion
const tempFolder = path.join(__dirname, "temp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder);

// Default triggers
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

// Convert MP3 to Opus
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

// Get auto-reply settings from DB
async function getAutoReplySettings(number, pool) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        try {
            const statusResult = await client.query(
                'SELECT status FROM auto_reply_settings WHERE phone_number = $1',
                [sanitizedNumber]
            );
            const status = statusResult.rows.length ? statusResult.rows[0].status : "on";

            const triggersResult = await client.query(
                'SELECT trigger, type, content, reply_type, caption FROM custom_auto_reply_triggers WHERE phone_number = $1',
                [sanitizedNumber]
            );
            const triggers = triggersResult.rows.map(row => ({
                trigger: row.trigger,
                type: row.type,
                content: row.content,
                replyType: row.reply_type,
                caption: row.caption
            }));
            return { status, triggers };
        } finally {
            client.release();
        }
    } catch (err) {
        console.error("Error loading auto-reply settings:", err);
        return { status: "on", triggers: [] };
    }
}

// Save auto-reply status
async function saveAutoReplyStatus(number, status, pool) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        try {
            await client.query(
                'INSERT INTO auto_reply_settings (phone_number, status) VALUES ($1, $2) ON CONFLICT (phone_number) DO UPDATE SET status = $2, updated_at = CURRENT_TIMESTAMP',
                [sanitizedNumber, status]
            );
            return true;
        } finally { client.release(); }
    } catch (err) {
        console.error("Error saving auto-reply status:", err);
        return false;
    }
}

// Add custom trigger
async function addCustomTrigger(number, trigger, type, content, replyType, caption = null, pool) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        try {
            await client.query(
                'INSERT INTO custom_auto_reply_triggers (phone_number, trigger, type, content, reply_type, caption) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (phone_number, trigger) DO UPDATE SET type=$3, content=$4, reply_type=$5, caption=$6, updated_at=CURRENT_TIMESTAMP',
                [sanitizedNumber, trigger, type, content, replyType, caption]
            );
            return true;
        } finally { client.release(); }
    } catch (err) {
        console.error("Error adding custom trigger:", err);
        return false;
    }
}

// Delete custom trigger
async function deleteCustomTrigger(number, trigger, pool) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        try {
            const res = await client.query(
                'DELETE FROM custom_auto_reply_triggers WHERE phone_number=$1 AND trigger=$2',
                [sanitizedNumber, trigger]
            );
            return res.rowCount > 0;
        } finally { client.release(); }
    } catch (err) {
        console.error("Error deleting custom trigger:", err);
        return false;
    }
}

// Handle auto-reply for incoming messages
async function handleAutoReply(socket, msg, sender, number, isOwner, pool) {
    // Skip auto-reply for owner's messages
    if (isOwner) return;

    const settings = await getAutoReplySettings(number, pool);
    if (settings.status !== "on") return;

    let text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "";
    text = text.toLowerCase().trim();
    if (!text) return;

    let trigger = settings.triggers.find(t => t.trigger.toLowerCase() === text);

    if (!trigger) {
        const key = Object.keys(defaultTriggers).find(k => k.toLowerCase() === text);
        if (key) trigger = defaultTriggers[key];
    }

    if (!trigger) {
        // partial match custom triggers
        for (const t of settings.triggers) {
            if (text.includes(t.trigger.toLowerCase())) { trigger = t; break; }
        }
    }
    if (!trigger) {
        // partial match default triggers
        for (const key of Object.keys(defaultTriggers)) {
            if (text.includes(key.toLowerCase())) { trigger = defaultTriggers[key]; break; }
        }
    }
    if (!trigger) return;

    console.log("Trigger matched:", trigger);

    try {
        if (trigger.replyType === "text") {
            return socket.sendMessage(sender, { text: trigger.content }, { quoted: msg });
        }
        if (trigger.replyType === "image") {
            const { data } = await axios.get(trigger.content, { responseType: "arraybuffer" });
            return socket.sendMessage(sender, { image: Buffer.from(data), caption: trigger.caption || "" }, { quoted: msg });
        }
        if (trigger.replyType === "sticker") {
            const { data } = await axios.get(trigger.content, { responseType: "arraybuffer" });
            return socket.sendMessage(sender, { sticker: Buffer.from(data) }, { quoted: msg });
        }
        if (trigger.replyType === "video") {
            const { data } = await axios.get(trigger.content, { responseType: "arraybuffer" });
            return socket.sendMessage(sender, { video: Buffer.from(data), caption: trigger.caption || "" }, { quoted: msg });
        }
        if (trigger.replyType === "voice") {
            try {
                // Download the audio file
                const { data } = await axios.get(trigger.content, { responseType: "arraybuffer" });
                
                // Convert to Opus format for WhatsApp
                const opus = await convertMp3ToOpus(data);
                
                // Send as voice message with proper format
                return socket.sendMessage(
                    sender, 
                    { 
                        audio: opus, 
                        mimetype: "audio/ogg; codecs=opus", 
                        ptt: true 
                    }, 
                    { quoted: msg }
                );
            } catch (error) {
                console.error("Error sending voice message:", error);
                // Fallback to sending as regular audio
                return socket.sendMessage(
                    sender, 
                    { 
                        audio: { url: trigger.content }, 
                        mimetype: "audio/mpeg",
                        ptt: true 
                    }, 
                    { quoted: msg }
                );
            }
        }
    } catch (err) {
        console.error("Auto reply error:", err);
    }
}

// Handle auto-reply commands
async function handleAutoReplyCommand(socket, msg, sender, number, args, isOwner, pool, prefix) {
    if (!isOwner) return socket.sendMessage(sender, { text: "🚫 Only owner can use!" }, { quoted: msg });

    if (!args[0]) return socket.sendMessage(sender, { text: `Usage:\n${prefix}autoreply on/off/status/add/del/list` }, { quoted: msg });

    const cmd = args[0].toLowerCase();

    if (cmd === "on" || cmd === "off") {
        await saveAutoReplyStatus(number, cmd, pool);
        return socket.sendMessage(sender, { text: cmd === "on" ? "✅ Auto reply ON" : "❌ Auto reply OFF" }, { quoted: msg });
    }

    if (cmd === "status") {
        const s = await getAutoReplySettings(number, pool);
        return socket.sendMessage(sender, { text: `Status: ${s.status}\nTriggers: ${s.triggers.length}` }, { quoted: msg });
    }

    if (cmd === "list") {
        const s = await getAutoReplySettings(number, pool);
        let txt = "*Default Triggers:*\n";
        Object.keys(defaultTriggers).forEach(k => txt += `• ${k} → ${defaultTriggers[k].replyType}\n`);
        if (s.triggers.length > 0) {
            txt += "\n*Custom Triggers:*\n";
            s.triggers.forEach(t => txt += `• ${t.trigger} → ${t.type}\n`);
        }
        return socket.sendMessage(sender, { text: txt }, { quoted: msg });
    }

    if (cmd === "add") {
        if (args.length < 4) return socket.sendMessage(sender, { text: "❌ Invalid format" }, { quoted: msg });

        const triggerName = args[1];
        const type = args[2];
        let content = args.slice(3).join(" ");
        let caption = null;

        if ((type === "image" || type === "video") && content.includes('"')) {
            const parts = content.split('"');
            if (parts.length >= 3) {
                content = parts.slice(0, -1).join('"').trim();
                caption = parts[parts.length - 2];
            }
        }

        await addCustomTrigger(number, triggerName, type, content, type, caption, pool);
        return socket.sendMessage(sender, { text: `✅ Added: "${triggerName}" (${type})` }, { quoted: msg });
    }

    if (cmd === "del") {
        if (!args[1]) return socket.sendMessage(sender, { text: "❌ Specify trigger to delete" }, { quoted: msg });
        const success = await deleteCustomTrigger(number, args[1], pool);
        return socket.sendMessage(sender, { text: success ? "🗑️ Deleted" : "❌ Trigger not found" }, { quoted: msg });
    }
}

module.exports = {
    defaultTriggers,
    convertMp3ToOpus,
    getAutoReplySettings,
    saveAutoReplyStatus,
    addCustomTrigger,
    deleteCustomTrigger,
    handleAutoReply,
    handleAutoReplyCommand
};
