// ═══════════════════════════════════════════════════════
// 🎨 CLICKABLE BUTTON MENU
// ═══════════════════════════════════════════════════════

async function sendButtonMenu(sock, jid, db, config, isOwner, isAdmin) {
    const prefix = await db.get('prefix', '.');
    const mode = await db.get('botMode', 'public');
    const urlCount = await db.urlsCount ? await db.urlsCount() : 0;

    // Method 1: Interactive Button Message (v2)
    try {
        const buttonMsg = {
            text: `💝 *NewsBot LK*\n📰 ${urlCount} news sent | 🌍 ${mode.toUpperCase()} mode`,
            footer: '🦄 NewsBot LK v9.0.4',
            buttons: [
                { buttonId: 'menu', buttonText: { displayText: '📋 Menu' }, type: 1 },
                { buttonId: 'news', buttonText: { displayText: '📰 News' }, type: 1 },
                { buttonId: 'ping', buttonText: { displayText: '🏓 Ping' }, type: 1 },
            ],
            headerType: '',
            viewOnce: false
        };

        await sock.sendMessage(jid, buttonMsg);
        console.log('✅ Clickable buttons sent');
        return;
    } catch (e) {
        console.log('⚠️ Buttons not supported, trying method 2...');
    }

    // Method 2: Template Buttons with Hydrated
    try {
        const templateMsg = {
            text: `💝 *NewsBot LK*\n📰 ${urlCount} news | 🌍 ${mode.toUpperCase()}`,
            footer: '🦄 v9.0.4',
            templateButtons: [
                { index: 1, urlButton: { displayText: '📋 Menu', url: `https://wa.me/${sock.user?.id?.split(':')[0]}?text=${prefix}menu` } },
                { index: 2, quickReplyButton: { displayText: '📰 News', id: 'news' } },
                { index: 3, quickReplyButton: { displayText: '🏓 Ping', id: 'ping' } },
            ],
            viewOnce: false
        };
        await sock.sendMessage(jid, templateMsg);
        console.log('✅ Template buttons sent');
        return;
    } catch (e2) {
        console.log('⚠️ Template buttons also failed, sending text fallback');
    }

    // Fallback: Text menu
    const fallback = [
        '╭━━━━━━━━━━━━━━━━━━━━━━╮',
        '    📋 *QUICK MENU*',
        '╰━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        '📰 *' + urlCount + '* news | 🌍 ' + mode.toUpperCase(),
        '',
        '╭━━━ 📋 *COMMANDS* ━━━╮',
        '│ ❯ .menu  — Full menu',
        '│ ❯ .news  — Latest news',
        '│ ❯ .ping  — Check speed',
        '│ ❯ .stats — Statistics',
        '│ ❯ .btn   — Button menu',
        '╰━━━━━━━━━━━━━━━━━━━━━━╯',
        '',
        '🦄💝 *NewsBot LK*',
    ].join('\n');
    await sock.sendMessage(jid, { text: fallback });
}

// ═══════════════════════════════════════════════════════
// 📋 INTERACTIVE LIST MENU
// ═══════════════════════════════════════════════════════

async function sendListMenu(sock, jid) {
    try {
        const listMsg = {
            text: '💝 *NewsBot LK Menu*\nChoose a category:',
            footer: '🦄 NewsBot LK v9.0.4',
            title: '📋 *MAIN MENU*',
            buttonText: '📂 OPEN MENU',
            sections: [
                {
                    title: '📰 News & Info',
                    rows: [
                        { title: '📰 Latest News', description: '14 sources', rowId: 'news' },
                        { title: '📊 Statistics', description: 'Bot stats', rowId: 'stats' },
                        { title: '🏓 Ping', description: 'Check speed', rowId: 'ping' },
                    ]
                },
                {
                    title: '💾 Media',
                    rows: [
                        { title: '🖼️ Sticker', description: 'Reply to image', rowId: 'sticker' },
                        { title: '👁️ View Once', description: 'Reveal', rowId: 'vv' },
                        { title: '💾 Save', description: 'Save media', rowId: 'save' },
                    ]
                },
            ]
        };

        await sock.sendMessage(jid, listMsg);
        console.log('✅ List menu sent');
    } catch (e) {
        console.log('⚠️ List not supported');
        await sock.sendMessage(jid, { text: '❌ *Interactive lists not supported.*\n💡 Use *.menu* for text menu.' });
    }
}

// ═══════════════════════════════════════════════════════
// 🔘 HANDLE BUTTON/LIST RESPONSES
// ═══════════════════════════════════════════════════════

async function handleButtonResponse(sock, msg, jid, db, config, handlers) {
    try {
        // Get the clicked button ID from any format
        let buttonId = 
            msg.message?.buttonsResponseMessage?.selectedButtonId ||
            msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg.message?.templateButtonReplyMessage?.selectedId;

        if (!buttonId) return false;

        console.log('🔘 Button clicked:', buttonId);

        // Route to command
        switch (buttonId) {
            case 'menu':
                const { sendMainMenu } = require('./mainMenu');
                const prefix = await db.get('prefix', '.');
                await sendMainMenu(sock, jid, db, config, handlers.isOwner, handlers.isAdmin, handlers.isGroup, prefix);
                return true;

            case 'news':
                if (handlers.news) { await handlers.news(jid, handlers.isGroup); return true; }
                break;

            case 'stats':
                if (handlers.stats) { await handlers.stats(jid); return true; }
                break;

            case 'ping':
                const { handlePingCommand } = require('../commands/general');
                await handlePingCommand(sock, jid);
                return true;

            case 'sticker':
            case 'vv':
            case 'save':
                const { handleMediaCommands } = require('../commands/media');
                await handleMediaCommands(sock, msg, jid, '', buttonId, jid, db, buttonId);
                return true;
        }

        // If no match, treat as a text command
        const { handleMessage } = require('../handlers/messageHandler');
        // Simulate text message with button ID
        msg.message = { conversation: '.' + buttonId };
        await handleMessage(sock, msg, db, config);
        return true;

    } catch (e) {
        console.error('❌ Button handler error:', e.message);
        return false;
    }
}

module.exports = { sendButtonMenu, sendListMenu, handleButtonResponse };
