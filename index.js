import { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import Groq from 'groq-sdk';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import figlet from 'figlet';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// 📋 CONFIG
// ============================================
const CONFIG = {
    PORT: 3000,
    BOT_NAME: 'SASIYA_AI',
    VERSION: '2.0.0',
    PREFIX: '.',
    SESSIONS_DIR: path.join(__dirname, 'sessions'),
    PAIRING_CODES: {}
};

// ============================================
// 📁 FILE SETUP
// ============================================
if (!fs.existsSync(CONFIG.SESSIONS_DIR)) {
    fs.mkdirSync(CONFIG.SESSIONS_DIR, { recursive: true });
}

// ============================================
// 🎨 BANNER
// ============================================
console.log(chalk.cyan(figlet.textSync('SASIYA AI', { font: 'Standard' })));
console.log(chalk.green('🤖 AI WhatsApp Bot - QR + Pairing Code'));
console.log(chalk.yellow('📌 Personal & Group Chat Support'));
console.log(chalk.yellow('🔢 2-Minute Pairing Code'));
console.log(chalk.yellow('═══════════════════════════════════════\n'));

// ============================================
// 📱 WHATSAPP BOT
// ============================================
let sock = null;
let isConnected = false;
let qrCodeData = null;
let currentPairingCode = null;
let pairingCodeExpiry = null;

async function connectWhatsApp() {
    const sessionFile = path.join(CONFIG.SESSIONS_DIR, 'bot_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionFile);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS('SASIYA AI'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        logger: pino({ level: 'silent' })
    });

    // 🔥 QR CODE HANDLER
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            // Generate QR as base64 for web
            try {
                qrCodeData = await QRCode.toDataURL(qr);
                console.log(chalk.yellow('\n📱 QR Code Generated!'));
                console.log(chalk.gray('Scan with WhatsApp or use Pairing Code\n'));
            } catch (e) {
                console.log(chalk.red('QR Generation Error:', e.message));
            }
        }

        if (connection === 'open') {
            isConnected = true;
            console.log(chalk.green(`\n✅ ${CONFIG.BOT_NAME} Connected!\n`));
            
            // Send welcome message
            try {
                await sock.sendMessage(CONFIG.OWNER + '@s.whatsapp.net', {
                    text: `🤖 *${CONFIG.BOT_NAME} Activated!*\n\n✅ Status: Online\n🔢 Pairing Code: ${currentPairingCode || 'Not Set'}\n🌐 Dashboard: http://localhost:${CONFIG.PORT}`
                });
            } catch (e) {}
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            isConnected = false;
            if (shouldReconnect) {
                console.log(chalk.yellow('🔄 Reconnecting...'));
                setTimeout(connectWhatsApp, 5000);
            } else {
                console.log(chalk.red('❌ Logged Out!'));
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 🔥 PAIRING CODE HANDLER - 2 MINUTES
    sock.ev.on('pairing-code', async (code) => {
        currentPairingCode = code;
        pairingCodeExpiry = Date.now() + 120000; // 2 minutes
        console.log(chalk.green(`\n🔢 Pairing Code: ${code}`));
        console.log(chalk.gray(`⏱️ Expires in 2 minutes\n`));
        
        // Auto expire after 2 minutes
        setTimeout(() => {
            currentPairingCode = null;
            pairingCodeExpiry = null;
            console.log(chalk.yellow('⏰ Pairing Code Expired!'));
        }, 120000);
    });

    // 📨 MESSAGE HANDLER
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const sender = msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const text = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || 
                        msg.message.imageMessage?.caption || '';

            console.log(chalk.blue(`📨 ${senderNumber}: ${text}`));

            // 🤖 AI Response (Groq)
            if (text.startsWith(CONFIG.PREFIX)) {
                const prompt = text.replace(CONFIG.PREFIX, '').trim();
                if (prompt) {
                    try {
                        // Your Groq AI integration here
                        const aiResponse = await getAIResponse(prompt);
                        await sock.sendMessage(sender, { text: aiResponse });
                    } catch (e) {
                        await sock.sendMessage(sender, { 
                            text: `❌ AI Error: ${e.message}` 
                        });
                    }
                }
            } else if (text.toLowerCase().match(/\b(hi|hello|හායි|හෙලෝ|good morning)\b/)) {
                await sock.sendMessage(sender, {
                    text: `👋 හායි! මම *${CONFIG.BOT_NAME}*.\nType *${CONFIG.PREFIX}help* for commands!\n\n🔢 Pairing Code: ${currentPairingCode || 'Not Available'}`
                });
            }
        }
    });

    return sock;
}

// ============================================
// 🤖 AI RESPONSE FUNCTION
// ============================================
async function getAIResponse(prompt) {
    // Add your Groq AI integration here
    // For now, return a simple response
    return `🤖 *AI Response*\n\n${prompt}\n\n(This is a demo response. Add your Groq API key for real AI!)`;
}

// ============================================
// 🌐 EXPRESS SERVER
// ============================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 📡 API ROUTES

// Get QR Code + Pairing Code
app.get('/api/qr', (req, res) => {
    res.json({
        qr: qrCodeData || null,
        pairingCode: currentPairingCode || null,
        isConnected: isConnected,
        expiry: pairingCodeExpiry || null,
        timeRemaining: pairingCodeExpiry ? Math.max(0, Math.floor((pairingCodeExpiry - Date.now()) / 1000)) : 0
    });
});

// Get Bot Status
app.get('/api/status', (req, res) => {
    res.json({
        name: CONFIG.BOT_NAME,
        version: CONFIG.VERSION,
        status: isConnected ? 'online' : 'offline',
        pairingCode: currentPairingCode || null,
        qrAvailable: qrCodeData ? true : false
    });
});

// Generate new pairing code (manual)
app.post('/api/generate-pair', async (req, res) => {
    if (!sock || !isConnected) {
        return res.status(400).json({ error: 'Bot not connected!' });
    }
    
    // Generate 8-digit code
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    currentPairingCode = code;
    pairingCodeExpiry = Date.now() + 120000;
    
    setTimeout(() => {
        currentPairingCode = null;
        pairingCodeExpiry = null;
    }, 120000);
    
    res.json({
        success: true,
        code: code,
        expiresIn: 120
    });
});

// ============================================
// 🚀 START
// ============================================

// Start WhatsApp bot
connectWhatsApp();

// Start web server
app.listen(CONFIG.PORT, () => {
    console.log(chalk.cyan(`\n🌐 Web Dashboard: http://localhost:${CONFIG.PORT}`));
    console.log(chalk.green(`📱 Bot Status: ${isConnected ? '✅ Online' : '⏳ Connecting...'}`));
    console.log(chalk.yellow(`🔢 QR + Pairing Code: ACTIVE`));
    console.log(chalk.gray(`\n📌 Access web for QR Code and Pairing Code\n`));
});

// Handle shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    if (sock) await sock.logout();
    process.exit(0);
});
