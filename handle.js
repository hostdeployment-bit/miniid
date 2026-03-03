const { get, input } = require("./configdb");
const { exec } = require('child_process');

const formatMessage = (title, content, footer) => {
    return `*${title}*\n\n${content}\n\n> *${footer}*`;
};

// Function to handle setting updates
const handleSettingUpdate = async (settingType, newValue, reply, number, pool) => {
    try {
        // Get current value from database
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT config_data FROM configs WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length === 0) {
                return await reply("❌ No configuration found for this number.");
            }
            
            const configData = result.rows[0].config_data;
            const currentValue = configData[settingType];
            
            if (currentValue === newValue) {
                return await reply("*This setting is already updated!*");
            }
            
            // Update the specific setting
            configData[settingType] = newValue;
            
            // Save back to database
            await client.query(
                'UPDATE configs SET config_data = $1 WHERE phone_number = $2',
                [JSON.stringify(configData), sanitizedNumber]
            );
            
            await reply(`➟ *${settingType.replace(/_/g, " ").toUpperCase()} updated: ${newValue}*`);
            return true; // Return true on success
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating setting:', error);
        await reply("❌ Failed to update setting. Please try again.");
        return false; // Return false on failure
    }
};

// Restart function
const restartBot = async (socket, number) => {
    try {
        const userJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
        await socket.sendMessage(userJid, {
            text: formatMessage(
                '🔄 RESTARTING BOT',
                'The bot is restarting now. Please wait a moment...',
                'popkid xmd mini'
            )
        });
        
        // Close the socket
        socket.ws.close();
        
        // Restart the process
        setTimeout(() => {
            exec(`pm2 restart ${process.env.PM2_NAME || 'SULA-MINI-main'}`);
        }, 2000);
    } catch (error) {
        console.error('Error restarting bot:', error);
    }
};

// Function to load and apply config from database
const loadAndApplyConfig = async (number, config, pool) => {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const client = await pool.connect();
        
        try {
            const result = await client.query(
                'SELECT config_data FROM configs WHERE phone_number = $1',
                [sanitizedNumber]
            );
            
            if (result.rows.length > 0) {
                const configData = result.rows[0].config_data;
                // Apply the loaded config to the global config object
                Object.keys(configData).forEach(key => {
                    config[key] = configData[key];
                });
                console.log(`Applied config from database for ${sanitizedNumber}`);
                return configData;
            }
            return null;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
};

// Export all command handlers
module.exports = {
    handleSettingUpdate,
    restartBot,
    loadAndApplyConfig
};
