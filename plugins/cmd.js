const { sms } = require("../msg");
const axios = require('axios');
const path = require('path');
const fs = require('fs-extra');
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const yts = require('yt-search');
const ddownr = require('denethdev-ytmp3');
const { igdl } = require('ruhend-scraper');
const cheerio = require('cheerio');
const Jimp = require('jimp');
const FileType = require('file-type');
const moment = require('moment-timezone');

const config = {
    PREFIX: '.',
    RCD_IMAGE_PATH: './sulabot.jpg',
    OWNER_NUMBER: '254111385747',
    FOOTER: '> popkid md bot',
    CAPTION: '> popkid md bot',
    AUTO_LIKE_EMOJI: ['💋', '🍬', '🫆', '💗', '🎈', '🎉', '🥳', '❤️', '🧫', '🐭'],
    MAX_RETRIES: 3
};

function formatMessage(title, content, footer) {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
}

async function convertMp3ToOpus(mp3Buffer) {
    const tempFolder = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder);
    
    const tempMp3 = path.join(tempFolder, `${Date.now()}.mp3`);
    const tempOgg = path.join(tempFolder, `${Date.now()}.ogg`);
    const ffmpeg = require("fluent-ffmpeg");
    const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
    
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    
    fs.writeFileSync(tempMp3, mp3Buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(tempMp3)
            .audioCodec("libopus")
            .format("opus")
            .on("end", () => resolve())
            .on("error", reject)
            .save(tempOgg);
    });

    const opusData = fs.readFileSync(tempOgg);

    fs.unlinkSync(tempMp3);
    fs.unlinkSync(tempOgg);

    return opusData;
}

const commands = {
    button: {
        name: 'button',
        description: 'Display button menu',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const buttons = [
                {
                    buttonId: `${config.PREFIX}menu`,
                    buttonText: { displayText: 'MENU' },
                    type: 1
                },
                {
                    buttonId: `${config.PREFIX}alive`,
                    buttonText: { displayText: 'Alive' },
                    type: 1
                }
            ];

            const captionText = 'popkid md bot';
            const footerText = 'popkid md bot';

            const buttonMessage = {
                image: { url: "https://i.ibb.co/TDgzTB29/SulaMd.png" },
                caption: captionText,
                footer: footerText,
                buttons,
                headerType: 1
            };

            socket.sendMessage(from, buttonMessage, { quoted: msg });
        }
    },

    alive: {
        name: 'alive',
        description: 'Check bot status',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const socketCreationTime = require('../index').socketCreationTime;
            const activeSockets = require('../index').activeSockets;
            
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

            await socket.sendMessage(from, {
                buttons: templateButtons,
                headerType: 1,
                viewOnce: true,
                image: { url: "https://i.ibb.co/TDgzTB29/SulaMd.png" },
                caption: `popkid md bot\n\n${captionText}`,
            }, { quoted: msg });
        }
    },

    menu: {
        name: 'menu',
        description: 'Display command menu',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const captionText = `
➤ Available Commands..!! 🌐💭\n\n┏━━━━━━━━━ ◉◉➢\n┇ *\`${config.PREFIX}alive\`*\n┋ • Show bot status\n┋\n┋ *\`${config.PREFIX}ping\`*\n┋ • View Bot Speed\n┋\n┋ *\`${config.PREFIX}song\`*\n┋ • Downlode Songs\n┋\n┋ *\`${config.PREFIX}winfo\`*\n┋ • Get User Profile Picture\n┋\n┋ *\`${config.PREFIX}aiimg\`*\n┋ • Genarate Ai Image\n┋\n┋ *\`${config.PREFIX}img\`*\n┋ • Search Image\n┋\n┋ *\`${config.PREFIX}logo\`*\n┋ • Create Logo\n┋\n┋ *\`${config.PREFIX}fancy\`*\n┋ • View Fancy Text\n┋\n┋ *\`${config.PREFIX}tiktok\`*\n┋ • Downlode tiktok video\n┋\n┋ *\`${config.PREFIX}fb\`*\n┋ • Downlode facebook video\n┋\n┋ *\`${config.PREFIX}ig\`*\n┋ • Downlode instagram video\n┋\n┋ *\`${config.PREFIX}ts\`*\n┋ • Search tiktok videos\n┋\n┋ *\`${config.PREFIX}ai\`*\n┋ • New Ai Chat\n┇\n┇ *\`${config.PREFIX}vv\`*\n┇• Get Viewonce Massage\n┋\n┋ *\`${config.PREFIX}save\`*\n┋ • Save Status\n┋\n┋ *\`${config.PREFIX}nasa\`*\n┋ • View latest nasa news update\n┋\n┋ *\`${config.PREFIX}gossip\`*\n┋ • View gossip news update\n┋\n┋ \`${config.PREFIX}cricket\`\n┇ • cricket news updates\n┇\n┇ *\`${config.PREFIX}bomb\`*\n┇• Send Bomb Massage\n┋\n┋ *\`${config.PREFIX}pair\`*\n┋ • Get Pair Code\n┇\n┇ *\`${config.PREFIX}deleteme\`*\n┇• Delete your session\n┋\n┗━━━━━━━━━━━ ◉◉➣\n\n*▫️SULA-MD Mini Bot Web 🌐*\n> https://sula-brown.vercel.app/minibot.html
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

            await socket.sendMessage(from, {
                buttons: templateButtons,
                headerType: 1,
                viewOnce: true,
                image: { url: "https://i.ibb.co/TDgzTB29/SulaMd.png" },
                caption: `popkid md bot\n\n${captionText}`,
            }, { quoted: msg });
        }
    },

    save: {
        name: 'save',
        description: 'Save WhatsApp status',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                    text: '❌ *Failed to save status.*'
                });
            }
        }
    },

    ping: {
        name: 'ping',
        description: 'Check bot response time',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            await socket.sendMessage(sender, { react: { text: "🚀", key: msg.key } });

            var inital = new Date().getTime();
            const { key } = await socket.sendMessage(sender, { text: '```Ping!!!```' });
            var final = new Date().getTime();
            await socket.sendMessage(sender, { text: '*Pong*  *' + (final - inital) + ' ms* ', edit: key });
        }
    },

    owner: {
        name: 'owner',
        description: 'Get owner contact',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const ownerNumber = '+94760663483';
            const ownerName = 'popkid md bot';
            const organization = '*popkid md* WHATSAPP BOT DEVELOPER 🍬';

            const vcard = 'BEGIN:VCARD\n' +
                          'VERSION:3.0\n' +
                          `FN:${ownerName}\n` +
                          `ORG:${organization};\n` +
                          `TEL;type=CELL;type=VOICE;waid=${ownerNumber.replace('+', '')}:${ownerNumber}\n` +
                          'END:VCARD';

            try {
                const sent = await socket.sendMessage(from, {
                    contacts: {
                        displayName: ownerName,
                        contacts: [{ vcard }]
                    }
                });

                await socket.sendMessage(from, {
                    text: `*POPKID-MD OWNER*\n\n👤 Name: ${ownerName}\n📞 Number: ${ownerNumber}\n\n> popkid md bot`,
                    contextInfo: {
                        mentionedJid: [`${ownerNumber.replace('+', '')}@s.whatsapp.net`],
                        quotedMessageId: sent.key.id
                    }
                }, { quoted: msg });

            } catch (err) {
                console.error('❌ Owner command error:', err.message);
                await socket.sendMessage(from, {
                    text: '❌ Error sending owner contact.'
                }, { quoted: msg });
            }
        }
    },

    vv: {
        name: 'vv',
        description: 'View once message viewer',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                return;
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
                            'Decrypting ViewOnce Message...',
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
        }
    },

    cnr: {
        name: 'cnr',
        description: 'React to newsletter with custom emoji',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q = body.trim();

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
        }
    },

    cnrl: {
        name: 'cnrl',
        description: 'React to newsletter with random love emoji',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q = body.trim();

            try {
                const link = q.split(',')[0].trim();

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
        }
    },

    cnrh: {
        name: 'cnrh',
        description: 'React to newsletter with random funny emoji',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q = body.trim();

            try {
                const link = q.split(',')[0].trim();

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
        }
    },

    fc: {
        name: 'fc',
        description: 'Follow a newsletter channel',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            if (args.length === 0) {
                return await socket.sendMessage(sender, {
                    text: '❗ Please provide a channel JID.\n\nExample:\n.fc 120363423997837331@newsletter'
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
        }
    },

    pair: {
        name: 'pair',
        description: 'Get pairing code for WhatsApp',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            const q = msg.message?.conversation ||
                      msg.message?.extendedTextMessage?.text ||
                      msg.message?.imageMessage?.caption ||
                      msg.message?.videoMessage?.caption || '';

            const phoneNumber = q.replace(/^[.\/!]pair\s*/i, '').trim();

            if (!phoneNumber) {
                return await socket.sendMessage(sender, {
                    text: '*📌 Usage:* .pair +9476066XXXX'
                }, { quoted: msg });
            }

            try {
                const url = `https://sulamini-965f457bb5bc.herokuapp.com/code?number=${encodeURIComponent(phoneNumber)}`;
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
                    text: `> *popkid md bot* ✅\n\n*🔑 Your pairing code is:* ${result.code}`
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
        }
    },

    img: {
        name: 'img',
        description: 'Search and send images',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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

                await socket.sendMessage(from, buttonMessage, { quoted: msg });

            } catch (err) {
                console.error("❌ image axios error:", err.message);
                await socket.sendMessage(sender, {
                    text: '❌ Failed to fetch images.'
                }, { quoted: msg });
            }
        }
    },

    logo: {
        name: 'logo',
        description: 'Create text logos',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q = args.join(" ");

            if (!q || q.trim() === '') {
                return await socket.sendMessage(sender, { text: '*`Need a name for logo`*' });
            }

            await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });
            const list = await axios.get('https://raw.githubusercontent.com/md2839pv404/anony0808/refs/heads/main/ep.json');

            const rows = list.data.map((v) => ({
                title: v.name,
                description: 'Tap to generate logo',
                id: `${config.PREFIX}dllogo https://api-pink-venom.vercel.app/api/logo?url=${v.url}&name=${q}`
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
                caption: 'popkid md bot🫣\n\n❏ *LOGO MAKER*',
                image: { url: 'https://i.ibb.co/TDgzTB29/SulaMd.png' },
            };

            await socket.sendMessage(from, buttonMessage, { quoted: msg });
        }
    },

    dllogo: {
        name: 'dllogo',
        description: 'Download generated logo',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q = args.join(" ");
            if (!q) return reply("Please give me url for capture the screenshot !!");

            try {
                const res = await axios.get(q);
                const images = res.data.result.download_url;

                await socket.sendMessage(from, {
                    image: { url: images },
                    caption: config.CAPTION
                }, { quoted: msg });
            } catch (e) {
                console.log('Logo Download Error:', e);
                await socket.sendMessage(from, {
                    text: `❌ Error:\n${e.message}`
                }, { quoted: msg });
            }
        }
    },

    aiimg: {
        name: 'aiimg',
        description: 'Generate AI images',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                await socket.sendMessage(sender, {
                    text: '🧠 *Creating your AI image...*',
                });

                const apiUrl = `https://api.siputzx.my.id/api/ai/flux?prompt=${encodeURIComponent(prompt)}`;
                const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

                if (!response || !response.data) {
                    return await socket.sendMessage(sender, {
                        text: '❌ *API did not return a valid image. Please try again later.*'
                    });
                }

                const imageBuffer = Buffer.from(response.data, 'binary');

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
        }
    },

    fancy: {
        name: 'fancy',
        description: 'Convert text to fancy fonts',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const q =
                msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption ||
                msg.message?.videoMessage?.caption || '';

            const text = q.trim().replace(/^.fancy\s+/i, "");

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
        }
    },

    ts: {
        name: 'ts',
        description: 'Search TikTok videos',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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

                    const media = await socket.prepareWAMessageMedia({ video: videoBuffer.data }, {
                        upload: socket.waUploadToServer
                    });

                    return {
                        body: proto.Message.InteractiveMessage.Body.fromObject({ text: '' }),
                        footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "𝐒𝚄𝙻𝙰 𝐒𝙳 𝐅𝚁𝙴𝙴 𝐁𝙾𝚃" }),
                        header: proto.Message.InteractiveMessage.Header.fromObject({
                            title: vid.description,
                            hasMediaAttachment: true,
                            videoMessage: media.videoMessage
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                            buttons: []
                        })
                    };
                }));

                const msgContent = socket.generateWAMessageFromContent(sender, {
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
        }
    },

    bomb: {
        name: 'bomb',
        description: 'Send bomb messages',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const isBotUser = require('../index').activeSockets.has(msg.key.participant?.split('@')[0]);

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
                    text: '📌 *Usage:* .bomb <number>,<message>,<count>\n\nExample:\n.bomb 9476XXXXXXX,Hello 👋,5'
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
                await new Promise(resolve => setTimeout(resolve, 700));
            }

            await socket.sendMessage(sender, {
                text: `✅ Bomb sent to ${target} — ${count}x`
            }, { quoted: msg });
        }
    },

    tiktok: {
        name: 'tiktok',
        description: 'Download TikTok videos',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
        }
    },

    fb: {
        name: 'fb',
        description: 'Download Facebook videos',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
        }
    },

    gossip: {
        name: 'gossip',
        description: 'Get gossip news',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                        'popkid md bot'
                    )
                });
            } catch (error) {
                console.error(`Error in 'news' case: ${error.message}`);
                await socket.sendMessage(sender, {
                    text: '⚠️ නිව්ස් ගන්න බැරි වුණා සුද්දෝ! 😩 යමක් වැරදුණා වගේ.'
                });
            }
        }
    },

    nasa: {
        name: 'nasa',
        description: 'Get NASA astronomy picture of the day',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            try {
                const response = await fetch('https://api.nasa.gov/planetary/apod?api_key=8vhAFhlCDlRLzt5P1iLu2OOMkxtmScpO5VmZEjZ');
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
                        '🌌 popkid md bot',
                        `🌠 *${title}*\n\n${explanation.substring(0, 200)}...\n\n📆 *Date*: ${date}\n${copyright ? `📝 *Credit*: ${copyright}` : ''}\n🔗 *Link*: https://apod.nasa.gov/apod/astropix.html`,
                        '> popkid md bot'
                    )
                });

            } catch (error) {
                console.error(`Error in 'apod' case: ${error.message}`);
                await socket.sendMessage(sender, {
                    text: '⚠️ ඕවා බලන්න ඕනි නිදාගන්න.'
                });
            }
        }
    },

    cricket: {
        name: 'cricket',
        description: 'Get cricket news',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
        }
    },

    song: {
        name: 'song',
        description: 'Download songs from YouTube',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            function extractYouTubeId(url) {
                const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
                const match = url.match(regex);
                return match ? match[1] : null;
            }

            function convertYouTubeLink(input) {
                const videoId = extractYouTubeId(input);
                if (videoId) {
                    return `https://www.youtube.com/watch?v=${videoId}`;
                }
                return input;
            }

            const q = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      msg.message?.imageMessage?.caption || 
                      msg.message?.videoMessage?.caption || '';

            if (!q || q.trim() === '') {
                return await socket.sendMessage(sender, { text: '*`Need YT_URL or Title`*' });
            }

            const fixedQuery = convertYouTubeLink(q.trim());

            try {
                const search = await yts(fixedQuery);
                const data = search.videos[0];
                if (!data) {
                    return await socket.sendMessage(sender, { text: '*`No results found`*' });
                }

                const url = data.url;
                const desc = `
🎵 *𝚃𝚒𝚝𝚕𝚎 :* \`${data.title}\`

◆⏱️ *𝙳𝚞𝚛𝚊𝚝𝚒𝚘𝚗* : ${data.timestamp} 

◆ *𝚅𝚒𝚎𝚠𝚜* : ${data.views}

◆ 📅 *𝚁𝚎𝚕𝚎𝚊𝚜 𝙳𝚊𝚝𝚒𝚘𝚗* : ${data.ago}
`;

                await socket.sendMessage(sender, {
                    image: { url: data.thumbnail },
                    caption: desc,
                }, { quoted: msg });

                await socket.sendMessage(sender, { react: { text: '⬇️', key: msg.key } });

                const result = await ddownr.download(url, 'mp3');
                const downloadLink = result.downloadUrl;

                await socket.sendMessage(sender, { react: { text: '⬆️', key: msg.key } });

                await socket.sendMessage(sender, {
                    audio: { url: downloadLink },
                    mimetype: "audio/mpeg",
                    ptt: true
                }, { quoted: msg });
            } catch (err) {
                console.error(err);
                await socket.sendMessage(sender, { text: "*`Error occurred while downloading`*" });
            }
        }
    },

    winfo: {
        name: 'winfo',
        description: 'Get WhatsApp user info',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            console.log('winfo command triggered for:', number);
            if (!args[0]) {
                await socket.sendMessage(sender, {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage(
                        '❌ ERROR',
                        'Please provide a phone number! Usage: .winfo +94xxxxxxxxx',
                        '> popkid md bot'
                    )
                });
                return;
            }

            let inputNumber = args[0].replace(/[^0-9]/g, '');
            if (inputNumber.length < 10) {
                await socket.sendMessage(sender, {
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: formatMessage(
                        '❌ ERROR',
                        'Invalid phone number! Please include country code (e.g., +94712345678)',
                        '> popkid md bot'
                    )
                });
                return;
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
                return;
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
        }
    },

    ig: {
        name: 'ig',
        description: 'Download Instagram videos',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
        }
    },

    deleteme: {
        name: 'deleteme',
        description: 'Delete your session',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            const sessionPath = path.join('./session', `session_${number.replace(/[^0-9]/g, '')}`);
            if (fs.existsSync(sessionPath)) {
                fs.removeSync(sessionPath);
            }
            
            const activeSockets = require('../index').activeSockets;
            const socketCreationTime = require('../index').socketCreationTime;
            
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
        }
    },

    setting: {
        name: 'setting',
        description: 'Bot settings menu',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            try {
                if (!isOwner) {
                    return await reply("🚫 *You are not authorized to use this command!*");
                }

                const settingOptions = {
                    name: 'single_select',
                    paramsJson: JSON.stringify({
                        title: '🔧 popkid md bot typing',
                        sections: [
                            {
                                title: '➤ 𝐖𝙾𝚁𝙺 𝐓𝚈𝙿𝙴',
                                rows: [
                                    { title: '𝐏𝚄𝙱𝙻𝙸𝙲', description: '', id: `${config.PREFIX}wtype public` },
                                    { title: '𝐎𝙽𝙻𝙸 𝐆𝚁𝙾𝚄𝙿', description: '', id: `${config.PREFIX}wtype groups` },
                                    { title: '𝐎𝙽𝙻𝙸 𝐈𝙽𝙱𝙾𝚇', description: '', id: `${config.PREFIX}wtype inbox` },
                                    { title: '𝐎𝙽𝙻𝙸 𝐏𝚁𝙸𝚅𝙴𝚃', description: '', id: `${config.PREFIX}wtype private` },
                                ],
                            },
                            {
                                title: '➤ 𝐅𝙰𝙺𝙴 𝐑𝙴𝙲𝙾𝚁𝙸𝙽𝙶 & 𝐓𝚈𝙿𝙴𝙸𝙽𝙶',
                                rows: [
                                    { title: '𝐀𝚄𝚃𝙾 𝚃𝚈𝙿𝙸𝙽𝙶', description: '', id: `${config.PREFIX}wapres composing` },
                                    { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙲𝙾𝚁𝙸𝙽𝙶', description: '', id: `${config.PREFIX}wapres recording` },
                                ],
                            },
                            {
                                title: '➤ 𝐀𝙻𝙻𝙰𝚆𝚂 𝐎𝙽𝙻𝙸𝙽𝙴',
                                rows: [
                                    { title: '𝐀𝙻𝙻𝙰𝚆𝚂 𝐎𝙽𝙻𝙸𝙽𝙴 𝐎𝙵𝙵', description: '', id: `${config.PREFIX}wapres unavailable` },
                                    { title: '𝐀𝙻𝙻𝙰𝚆𝚂 𝐎𝙽𝙻𝙸𝙽𝙴 𝐎𝙽', description: '', id: `${config.PREFIX}wapres available` },
                                ],
                            },
                            {
                                title: '➤ 𝐀𝚄𝚃𝙾 𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽',
                                rows: [
                                    { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽 𝐎𝙽', description: '', id: `${config.PREFIX}rstatus on` },
                                    { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐒𝙴𝙴𝙽 𝐎𝙵𝙵', description: '', id: `${config.PREFIX}rstatus off` },
                                ],
                            }, 
                            {
                                title: '➤ 𝐀𝚄𝚃𝙾 𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃',
                                rows: [
                                    { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃 𝐎𝙽', description: '', id: `${config.PREFIX}arm on` },
                                    { title: '𝐒𝚃𝙰𝚃𝚄𝚂 𝐑𝙴𝙰𝙲𝚃 𝐎𝙵𝙵', description: '', id: `${config.PREFIX}arm off` },
                                ],
                            }, 
                            {
                                title: '➤ 𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲 𝐂𝙰𝙻𝙻',
                                rows: [
                                    { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲 𝐂𝙰𝙻𝙻 𝐎𝙽', description: '', id: `${config.PREFIX}creject on` },
                                    { title: '𝐀𝚄𝚃𝙾 𝐑𝙴𝙹𝙴𝙲 𝐂𝙰𝙻𝙻 𝐎𝙵𝙵', description: '', id: `${config.PREFIX}creject off` },
                                ],
                            },
                            {
                                title: '➤ 𝐀𝚄𝚃𝙾 𝐌𝙰𝚂𝚂𝙰𝙶𝙴 𝐑𝙴𝙰𝙳',
                                rows: [
                                    { title: '𝐑𝙴𝙰𝙳 𝐀𝙻𝙻 𝐌𝙰𝚂𝚂𝙴𝚂', description: '', id: `${config.PREFIX}mread all` },
                                    { title: '𝐑𝙴𝙰𝙳 𝐀𝙻𝙻 𝐒𝙰𝚂𝚂𝙴𝚂 𝐂𝙾𝙼𝙼𝙽𝙽', description: '', id: `${config.PREFIX}mread cmd` },
                                    { title: '𝐃𝙾𝙽𝚃 𝐑𝙴𝙰𝙳 𝐀𝙽𝙮 𝐌𝙰𝚂𝚂', description: '', id: `${config.PREFIX}mread off` },
                                ],
                            },
                        ],
                    }),
                };

                await socket.sendMessage(from, {
                    headerType: 1,
                    viewOnce: true,
                    image: { url: config.RCD_IMAGE_PATH },
                    caption: `╭────────────╮\npopkid md settings\n╰────────────╯\n\n` +
                        `┏━━━━━━━━━━◆◉◉➤` +
                        `┃◉ *WORK TYPE:* ${require('../index').config?.WORK_TYPE || 'public'}\n` +
                        `┃◉ *BOT PRESENCE:* ${require('../index').config?.PRESENCE || 'available'}\n` +
                        `┃◉ *AUTO STATUS SEEN:* ${require('../index').config?.AUTO_VIEW_STATUS || 'true'}\n` +
                        `┃◉ *AUTO STATUS REACT:* ${require('../index').config?.AUTO_LIKE_STATUS || 'true'}\n` +
                        `┃◉ *AUTO REJECT CALL:* ${require('../index').config?.ANTI_CALL || 'off'}\n` +
                        `┃◉ *AUTO MESSAGE READ :* ${require('../index').config?.AUTO_READ_MESSAGE || 'off'}\n` +
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
        }
    },

    wtype: {
        name: 'wtype',
        description: 'Change bot work type',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
            try {
                if (!isOwner) 
                    return await reply("🚫 *You are not authorized to use this command!*");      
                
                let q = args[0];
                const settings = {
                    groups:"groups",
                    inbox:"inbox",
                    private:"private",
                    public:"public"
                };
                
                if (settings[q]) {
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("WORK_TYPE", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    },

    wapres: {
        name: 'wapres',
        description: 'Change bot presence',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
            try {
                if (!isOwner) 
                    return await reply("🚫 *You are not authorized to use this command!*");      
                
                let q = args[0];
                const settings = {
                    composing:"composing",
                    recording:"recording",
                    available:"available",
                    unavailable:"unavailable"
                };
                
                if (settings[q]) {
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("PRESENCE", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    },

    rstatus: {
        name: 'rstatus',
        description: 'Toggle auto status view',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("AUTO_VIEW_STATUS", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    },

    creject: {
        name: 'creject',
        description: 'Toggle auto call reject',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("ANTI_CALL", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    },

    arm: {
        name: 'arm',
        description: 'Toggle auto status react',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
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
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("AUTO_LIKE_STATUS", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    },

    mread: {
        name: 'mread',
        description: 'Toggle auto message read',
        async execute(socket, msg, sender, from, args, isOwner, isGroup, reply, m, quoted, body, sanitizedNumber, number) {
            await socket.sendMessage(sender, { react: { text: '🛠️', key: msg.key } });
            try {
                if (!isOwner) 
                    return await reply("🚫 *You are not authorized to use this command!*");      
                
                let q = args[0];
                const settings = {
                    all:"all",
                    cmd:"cmd",
                    off:"off"
                };
                
                if (settings[q]) {
                    const { handleSettingUpdate } = require('../index');
                    await handleSettingUpdate("AUTO_READ_MESSAGE", settings[q], reply, number);
                }
            } catch (e) {
                console.log(e);
                reply(`${e}`);
            }
        }
    }
};

module.exports = commands;
