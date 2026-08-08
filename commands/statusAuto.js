// commands/statusAuto.js

/**
 * Handle WhatsApp Status (Auto View / Auto Like)
 * @param {Object} sock - Baileys socket connection
 * @param {Object} msg - Incoming message object
 */
async function handleStatus(sock, msg) {
    try {
        if (!msg.message || !msg.key) return;

        const statusJid = 'status@broadcast';
        
        // 1. Status එක එවූ කෙනාගේ ID එක සහ Message ID එක ලබා ගැනීම
        const sender = msg.key.participant || msg.key.remoteJid;
        const messageId = msg.key.id;

        // 2. 👁️ Status එක Read/View කළ බව WhatsApp එකට දැන්වීම (Auto View Status)
        await sock.readMessages([
            {
                remoteJid: statusJid,
                id: messageId,
                participant: sender
            }
        ]);

        console.log(`👁️ [Status Auto Read] Viewed status from: ${sender.split('@')[0]}`);

        // 3. ❤️ Status එකට Auto React/Like එකක් යැවීම (Optional)
        /* 
        await sock.sendMessage(
            statusJid,
            {
                react: {
                    text: '❤️', // ඔබ කැමති Emoji එකක් යෙදිය හැක (💚, 🔥, 👍)
                    key: msg.key
                }
            },
            { statusJidList: [sender] }
        );
        console.log(`❤️ [Status Auto React] Liked status from: ${sender.split('@')[0]}`);
        */

    } catch (error) {
        console.error('❌ Error in Status Auto Read:', error.message);
    }
}

module.exports = { handleStatus };
