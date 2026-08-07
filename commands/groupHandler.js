async function handleGroupUpdate(sock, update, db) {
    const { id, participants, action } = update;
    if (action === 'add' && await db.get('welcomeEnabled', false)) {
        for (const p of participants) {
            await sock.sendMessage(id, { text: '🎉 *Welcome!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
    }
    if (action === 'remove' && await db.get('goodbyeEnabled', false)) {
        for (const p of participants) {
            await sock.sendMessage(id, { text: '😢 *Goodbye!*\n👋 @' + p.split('@')[0], mentions: [p] });
        }
    }
}

module.exports = { handleGroupUpdate };
