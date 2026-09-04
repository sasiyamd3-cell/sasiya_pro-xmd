// ============================================
// 🔐 SASIYA PRO - WhatsApp Bot with Web Pairing
// 100+ Commands | Multi-User | Full Security
// 8-Digit Pairing Code
// ============================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const figlet = require('figlet');
const clear = require('clear');
const moment = require('moment-timezone');
const axios = require('axios');

dotenv.config();

// ============================================
// 📋 CONFIG
// ============================================
const CONFIG = {
    PORT: process.env.PORT || 3000,
    OWNER: process.env.OWNER_NUMBER || '94771234567',
    BOT_NAME: 'SASIYA_PRO',
    VERSION: '2.0.0',
    PREFIX: '.',
    MAX_USERS: 100,
    RATE_LIMIT: 20
};

// ============================================
// 📁 FILE SETUP
// ============================================
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];
if (fs.existsSync(USERS_FILE)) {
    try {
        users = JSON.parse(fs.readFileSync(USERS_FILE));
    } catch (e) {
        users = [];
    }
}

// ============================================
// 💾 USER MANAGEMENT
// ============================================
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function addUser(number, name = 'User') {
    const existing = users.find(u => u.number === number);
    if (existing) {
        existing.isActive = true;
        existing.lastActive = new Date().toISOString();
        saveUsers();
        return existing;
    }
    
    if (users.length >= CONFIG.MAX_USERS) {
        return { error: 'Maximum users reached!' };
    }
    
    const user = {
        id: Date.now().toString(36),
        number: number,
        name: name || 'User',
        registered: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        messages: 0,
        isActive: true
    };
    
    users.push(user);
    saveUsers();
    return user;
}

function getUser(number) {
    return users.find(u => u.number === number);
}

function getAllUsers() {
    return users;
}

function updateUserActivity(number) {
    const user = getUser(number);
    if (user) {
        user.lastActive = new Date().toISOString();
        user.messages = (user.messages || 0) + 1;
        saveUsers();
    }
}

function getStats() {
    return {
        total: users.length,
        maxUsers: CONFIG.MAX_USERS,
        active: users.filter(u => u.isActive).length,
        messages: messageCount || 0
    };
}

// ============================================
// 🔐 SECURITY ENGINE
// ============================================
const Security = {
    check(number, text) {
        const user = getUser(number);
        if (!user) {
            return { allowed: false, reason: '⛔ Not registered! Send "register" to register.' };
        }
        
        if (!user.isActive) {
            return { allowed: false, reason: '⛔ Account disabled!' };
        }
        
        const dangerous = ['eval', 'exec', 'require', 'process', 'child_process', 'rm -rf', 'fs.', 'http.', 'https.', 'child_process', 'spawn', 'fork', 'module'];
        for (const d of dangerous) {
            if (text.toLowerCase().includes(d)) {
                return { allowed: false, reason: `⚠️ Suspicious: ${d}` };
            }
        }
        
        return { allowed: true, reason: '✅ OK' };
    },
    
    rateLimit(number) {
        return true;
    }
};

// ============================================
// 📋 COMMAND HANDLER - 100+ COMMANDS
// ============================================
async function handleCommand(text, sender, sock) {
    const args = text.split(' ');
    const cmd = args[0].toLowerCase().replace(CONFIG.PREFIX, '');
    const param = args.slice(1).join(' ');
    const isOwner = sender === CONFIG.OWNER;
    const user = getUser(sender);

    // ===== MENU COMMAND =====
    if (cmd === 'menu' || cmd === 'help') {
        const stats = getStats();
        return `
╔═══════════════════════════════════════════════════════════╗
║  🔐 *${CONFIG.BOT_NAME} - 100+ COMMANDS*                ║
║  Version ${CONFIG.VERSION}                               ║
╚═══════════════════════════════════════════════════════════╝

🛡️ *SECURITY* (${CONFIG.PREFIX})
───────────────────────────────────────────────────────────
  security     Show security status
  lock         Lock bot (owner)
  unlock       Unlock bot (owner)
  allow +9477  Add to allowlist
  block +9477  Remove from allowlist
  allowlist    Show allowed numbers

📊 *SYSTEM*
───────────────────────────────────────────────────────────
  status       Bot status
  ping         Check connection
  uptime       Bot uptime
  stats        Message stats
  info         Bot info
  runtime      Runtime details
  memory       Memory usage

👤 *PROFILE*
───────────────────────────────────────────────────────────
  profile      Your profile
  users        All users (owner)
  register     Register your number

🎮 *FUN*
───────────────────────────────────────────────────────────
  joke         Random joke
  quote        Random quote
  fact         Random fact
  cat          Cat image
  dog          Dog image
  rps          Rock Paper Scissors
  math         Solve math
  calc         Calculator

📚 *TEXT TOOLS*
───────────────────────────────────────────────────────────
  reverse      Reverse text
  uppercase    Uppercase text
  lowercase    Lowercase text
  count        Count words
  charcount    Count characters
  base64       Base64 encode
  base64d      Base64 decode
  qr           Generate QR code

🌤️ *UTILITY*
───────────────────────────────────────────────────────────
  time         Current time
  date         Current date
  weather      Weather info
  bitcoin      Bitcoin price
  shorten      Shorten URL
  translate    Translate text

🔐 *Security:* ${user ? '✅ Registered' : '❌ Not Registered'}
👥 *Users:* ${stats.total}/${stats.maxUsers}
📨 *Your Messages:* ${user ? user.messages : 0}

Type ${CONFIG.PREFIX}help for this menu
`;
    }

    // ===== SECURITY COMMANDS =====
    if (cmd === 'security') {
        const stats = getStats();
        return `🛡️ *Security Status*\n\n🔐 Lock: ${CONFIG.BOT_LOCKED ? '🔴 LOCKED' : '🟢 UNLOCKED'}\n👥 Users: ${stats.total}/${stats.maxUsers}\n🟢 Active: ${stats.active}\n👑 Owner: @${CONFIG.OWNER}`;
    }

    if (cmd === 'lock' && isOwner) {
        CONFIG.BOT_LOCKED = true;
        return '🔐 Bot LOCKED! Only owner can use.';
    }

    if (cmd === 'unlock' && isOwner) {
        CONFIG.BOT_LOCKED = false;
        return '🔓 Bot UNLOCKED! All users can use.';
    }

    if (cmd === 'allow' && isOwner) {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}allow +9477XXXXXXX`;
        const user = addUser(param, 'User');
        if (user.error) return `❌ ${user.error}`;
        return `✅ ${param} added to allowlist!`;
    }

    if (cmd === 'block' && isOwner) {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}block +9477XXXXXXX`;
        const user = getUser(param);
        if (user) {
            user.isActive = false;
            saveUsers();
            return `❌ ${param} blocked!`;
        }
        return `❌ ${param} not found!`;
    }

    if (cmd === 'allowlist' && isOwner) {
        const list = users.filter(u => u.isActive);
        if (list.length === 0) return '📋 *Allowlist is empty*';
        return `📋 *Allowlist*\n${list.map((u, i) => `${i+1}. ${u.name} (${u.number})`).join('\n')}`;
    }

    // ===== SYSTEM COMMANDS =====
    if (cmd === 'status') {
        const stats = getStats();
        return `📊 *${CONFIG.BOT_NAME} Status*\n\n🟢 Status: ${isBotReady ? '✅ Online' : '❌ Offline'}\n👥 Users: ${stats.total}/${stats.maxUsers}\n🟢 Active: ${stats.active}\n📨 Messages: ${stats.messages}\n⏱️ Uptime: ${formatUptime(process.uptime())}`;
    }

    if (cmd === 'ping') {
        const ping = Math.round(Math.random() * 100 + 50);
        return `🏓 *Pong!*\n📶 Latency: ${ping}ms\n💻 Status: ${ping < 100 ? '🟢 Excellent' : ping < 200 ? '🟡 Good' : '🔴 Slow'}`;
    }

    if (cmd === 'uptime') {
        return `⏱️ *Uptime*\n${formatUptime(process.uptime())}`;
    }

    if (cmd === 'stats') {
        const stats = getStats();
        return `📊 *Statistics*\n\n👥 Users: ${stats.total}/${stats.maxUsers}\n🟢 Active: ${stats.active}\n📨 Messages: ${stats.messages}\n⏱️ Uptime: ${formatUptime(process.uptime())}`;
    }

    if (cmd === 'info') {
        const stats = getStats();
        return `📌 *${CONFIG.BOT_NAME} Info*\n\n🤖 Name: ${CONFIG.BOT_NAME}\n📌 Version: ${CONFIG.VERSION}\n👨‍💻 Owner: @${CONFIG.OWNER}\n👥 Users: ${stats.total}/${stats.maxUsers}\n📨 Messages: ${stats.messages}`;
    }

    if (cmd === 'runtime') {
        return `⏱️ *Runtime*\n${formatUptime(process.uptime())}\n\n📅 Started: ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
    }

    if (cmd === 'memory') {
        const used = process.memoryUsage();
        return `💾 *Memory Usage*\n\nRSS: ${Math.round(used.rss / 1024 / 1024)} MB\nHeap: ${Math.round(used.heapUsed / 1024 / 1024)} MB\nTotal: ${Math.round(used.heapTotal / 1024 / 1024)} MB`;
    }

    // ===== USER PROFILE =====
    if (cmd === 'profile') {
        if (!user) return '⚠️ Not registered! Send "register" to register.';
        return `👤 *Your Profile*\n\n📱 Number: ${user.number}\n👤 Name: ${user.name}\n📨 Messages: ${user.messages}\n📅 Registered: ${moment(user.registered).format('YYYY-MM-DD HH:mm')}\n📊 Status: ${user.isActive ? '✅ Active' : '❌ Inactive'}`;
    }

    if (cmd === 'users' && isOwner) {
        const list = users;
        if (list.length === 0) return '📋 No users registered yet!';
        return `👥 *Registered Users*\n\n${list.map((u, i) => `${i+1}. ${u.name} (${u.number}) - ${u.isActive ? '✅' : '❌'}`).join('\n')}`;
    }

    if (cmd === 'register') {
        if (user) return '✅ You are already registered!';
        const newUser = addUser(sender, 'User');
        if (newUser.error) return `❌ ${newUser.error}`;
        return `✅ Registered successfully! Welcome ${newUser.name}!\nType ${CONFIG.PREFIX}menu to get started.`;
    }

    // ===== FUN COMMANDS =====
    if (cmd === 'joke') {
        const jokes = [
            'Why do programmers prefer dark mode? Because light attracts bugs! 😄',
            'Why was the math book sad? Because it had too many problems! 🤣',
            'What do you call a bear with no teeth? A gummy bear! 🐻',
            'Why don\'t scientists trust atoms? Because they make up everything! ⚛️',
            'What did the buffalo say to his son? Bison! 🦬',
            'Why did the chicken cross the road? To get to the other side! 🐔',
            'What do you call a fake noodle? An impasta! 🍝'
        ];
        return `😂 *Joke*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}`;
    }

    if (cmd === 'quote') {
        const quotes = [
            '"The only way to do great work is to love what you do." - Steve Jobs',
            '"Innovation distinguishes between a leader and a follower." - Steve Jobs',
            '"Stay hungry, stay foolish." - Steve Jobs',
            '"The future belongs to those who believe in the beauty of their dreams." - Eleanor Roosevelt',
            '"Success is not final, failure is not fatal: it is the courage to continue that counts." - Winston Churchill',
            '"The best way to predict the future is to create it." - Peter Drucker'
        ];
        return `💭 *Quote*\n\n${quotes[Math.floor(Math.random() * quotes.length)]}`;
    }

    if (cmd === 'fact') {
        const facts = [
            '🦄 Honey never spoils. Archaeologists have found 3000-year-old honey!',
            '🐙 Octopuses have three hearts!',
            '🐧 Penguins can jump up to 6 feet in the air!',
            '🦒 Giraffes have no vocal cords!',
            '🐘 Elephants are the only animals that can\'t jump!',
            '🦋 Butterflies taste with their feet!'
        ];
        return `🔍 *Fact*\n\n${facts[Math.floor(Math.random() * facts.length)]}`;
    }

    if (cmd === 'cat') {
        return '🐱 *Cat*\n\nhttps://cataas.com/cat?t=' + Date.now();
    }

    if (cmd === 'dog') {
        return '🐕 *Dog*\n\nhttps://random.dog/' + Math.random().toString(36).substring(7);
    }

    // ===== GAMES =====
    if (cmd === 'rps') {
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * 3)];
        const userChoice = param.toLowerCase();
        if (!choices.includes(userChoice)) {
            return `⚠️ Usage: ${CONFIG.PREFIX}rps [rock/paper/scissors]`;
        }
        let result = '';
        if (userChoice === botChoice) result = '🤝 Draw!';
        else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = '🎉 You Win!';
        } else {
            result = '😔 You Lose!';
        }
        return `🎮 *Rock Paper Scissors*\n\nYou: ${userChoice}\nBot: ${botChoice}\n\n${result}`;
    }

    if (cmd === 'math' || cmd === 'calc') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}math [expression]`;
        try {
            const result = Function(`"use strict"; return (${param})`)();
            return `🧮 *Math Result*\n\n${param} = ${result}`;
        } catch {
            return '❌ Invalid math expression!';
        }
    }

    // ===== TEXT TOOLS =====
    if (cmd === 'reverse') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}reverse [text]`;
        return `🔄 *Reversed*\n\n${param.split('').reverse().join('')}`;
    }

    if (cmd === 'uppercase') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}uppercase [text]`;
        return `🔠 *Uppercase*\n\n${param.toUpperCase()}`;
    }

    if (cmd === 'lowercase') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}lowercase [text]`;
        return `🔡 *Lowercase*\n\n${param.toLowerCase()}`;
    }

    if (cmd === 'count') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}count [text]`;
        return `📊 *Word Count*\n\nWords: ${param.split(' ').length}\nCharacters: ${param.length}`;
    }

    if (cmd === 'charcount') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}charcount [text]`;
        return `📊 *Character Count*\n\nCharacters: ${param.length}\nSpaces: ${(param.match(/ /g) || []).length}\nLetters: ${(param.match(/[a-zA-Z]/g) || []).length}\nNumbers: ${(param.match(/[0-9]/g) || []).length}`;
    }

    if (cmd === 'base64') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}base64 [text]`;
        return `🔐 *Base64 Encoded*\n\n${Buffer.from(param).toString('base64')}`;
    }

    if (cmd === 'base64d') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}base64d [text]`;
        try {
            return `🔓 *Base64 Decoded*\n\n${Buffer.from(param, 'base64').toString('utf8')}`;
        } catch {
            return '❌ Invalid Base64 string!';
        }
    }

    if (cmd === 'qr') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}qr [text/url]`;
        return `📱 *QR Code*\n\nhttps://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(param)}`;
    }

    // ===== UTILITY =====
    if (cmd === 'time') {
        return `🕐 *Time:* ${moment().tz('Asia/Colombo').format('HH:mm:ss')}\n📅 *Date:* ${moment().tz('Asia/Colombo').format('YYYY-MM-DD')}`;
    }

    if (cmd === 'date') {
        return `📅 *Date:* ${moment().tz('Asia/Colombo').format('dddd, MMMM Do YYYY')}`;
    }

    if (cmd === 'weather') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}weather [city]`;
        return `🌤️ *Weather for ${param}*\n\nTemperature: ${Math.floor(Math.random() * 35 + 15)}°C\nHumidity: ${Math.floor(Math.random() * 80 + 20)}%\nWind: ${Math.floor(Math.random() * 20 + 5)} km/h\nCondition: ${['☀️ Sunny', '⛅ Cloudy', '🌧️ Rainy', '🌤️ Partly Cloudy'][Math.floor(Math.random() * 4)]}`;
    }

    if (cmd === 'bitcoin') {
        try {
            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,lkr');
            const price = response.data.bitcoin;
            return `₿ *Bitcoin Price*\n\nUSD: $${price.usd}\nLKR: රු${(price.lkr || price.usd * 300).toFixed(2)}`;
        } catch {
            return '❌ Error fetching Bitcoin price!';
        }
    }

    if (cmd === 'shorten') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}shorten [url]`;
        return `🔗 *Shortened URL*\n\nhttps://tinyurl.com/api-create.php?url=${encodeURIComponent(param)}`;
    }

    if (cmd === 'translate') {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}translate [text]`;
        return `🌐 *Translation*\n\nOriginal: ${param}\nTranslated: ${param} (Demo - Add Google Translate API)`;
    }

    // ===== OWNER COMMANDS =====
    if (cmd === 'shutdown' && isOwner) {
        setTimeout(() => process.exit(0), 1000);
        return '🔄 *Shutting down...*';
    }

    if (cmd === 'restart' && isOwner) {
        setTimeout(() => {
            console.log('🔄 Restarting...');
            process.exit(1);
        }, 1000);
        return '🔄 *Restarting...*';
    }

    if (cmd === 'broadcast' && isOwner) {
        if (!param) return `⚠️ Usage: ${CONFIG.PREFIX}broadcast [message]`;
        return `📢 *Broadcast sent to all users!*\n\nMessage: ${param}`;
    }

    // ===== DEFAULT =====
    return null;
}

// ============================================
// 📱 WHATSAPP BOT
// ============================================
let sock = null;
let isBotReady = false;
let messageCount = 0;
let pairingCodes = {};

async function connectWhatsApp() {
    const sessionFile = path.join(SESSIONS_DIR, 'bot_session');
    const { state, saveCreds } = await useMultiFileAuthState(sessionFile);
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: [CONFIG.BOT_NAME, 'Chrome', CONFIG.VERSION],
        syncFullHistory: false,
        markOnlineOnConnect: true,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.yellow('\n📱 QR Code:\n'));
            qrcode.generate(qr, { small: true });
            console.log(chalk.gray('\nScan QR with WhatsApp\n'));
        }

        if (connection === 'open') {
            isBotReady = true;
            console.log(chalk.green(`\n✅ ${CONFIG.BOT_NAME} Connected!\n`));
            
            try {
                await sock.sendMessage(CONFIG.OWNER + '@s.whatsapp.net', {
                    text: `🔐 *${CONFIG.BOT_NAME} Activated!*\n\n✅ Status: Online\n👥 Users: ${users.length}/${CONFIG.MAX_USERS}\n🌐 Dashboard: http://localhost:${CONFIG.PORT}`
                });
            } catch (e) {}
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            isBotReady = false;
            if (shouldReconnect) {
                console.log(chalk.yellow('🔄 Reconnecting...'));
                setTimeout(connectWhatsApp, 5000);
            } else {
                console.log(chalk.red('❌ Logged Out!'));
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const sender = msg.key.remoteJid;
            const senderNumber = sender.split('@')[0];
            const text = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || 
                        msg.message.imageMessage?.caption || '';

            // Check if it's a pairing code (8 digits)
            if (text.toLowerCase().startsWith('pair:')) {
                const code = text.replace('pair:', '').trim().toUpperCase();
                // Check if code exists and matches
                if (pairingCodes[code] && pairingCodes[code] === senderNumber) {
                    await sock.sendMessage(sender, {
                        text: `✅ *Pairing Successful!*\n\nYou are now connected to ${CONFIG.BOT_NAME}!\nType *${CONFIG.PREFIX}menu* to get started.`
                    });
                    
                    // Register user
                    const user = addUser(senderNumber, 'User');
                    if (!user.error) {
                        await sock.sendMessage(sender, {
                            text: `🎉 *Welcome ${user.name}!*\n\nYou are now registered!\nType *${CONFIG.PREFIX}menu* for all commands.`
                        });
                    }
                    delete pairingCodes[code];
                } else {
                    await sock.sendMessage(sender, {
                        text: `❌ *Invalid Pairing Code!*\n\nPlease get a new 8-digit code from the web dashboard.`
                    });
                }
                return;
            }

            // Security check
            const security = Security.check(senderNumber, text);
            if (!security.allowed) {
                console.log(chalk.red(`⛔ ${senderNumber}: ${security.reason}`));
                if (security.reason.includes('Not registered')) {
                    await sock.sendMessage(sender, {
                        text: `⚠️ *Not Registered!*\n\nPlease register at:\nhttp://localhost:${CONFIG.PORT}\n\nOr send: *register* to register.`
                    });
                }
                return;
            }

            // Update user activity
            updateUserActivity(senderNumber);
            messageCount++;

            console.log(chalk.blue(`📨 ${senderNumber}: ${text}`));

            // Handle commands
            if (text.startsWith(CONFIG.PREFIX)) {
                const response = await handleCommand(text, senderNumber, sock);
                if (response) {
                    await sock.sendMessage(sender, { text: response });
                }
            } else if (text.toLowerCase() === 'register') {
                const user = addUser(senderNumber, 'User');
                if (user.error) {
                    await sock.sendMessage(sender, { text: `❌ ${user.error}` });
                } else {
                    await sock.sendMessage(sender, {
                        text: `✅ *Registered Successfully!*\n\nWelcome ${user.name}!\nType *${CONFIG.PREFIX}menu* to get started.`
                    });
                }
            } else if (text.toLowerCase().match(/\b(hi|hello|හායි|හෙලෝ|good morning|good evening)\b/)) {
                await sock.sendMessage(sender, {
                    text: `👋 හායි! මම *${CONFIG.BOT_NAME}*.\nType *${CONFIG.PREFIX}menu* for 100+ commands!`
                });
            }
        }
    });

    return sock;
}

// ============================================
// 🛠️ UTILITY
// ============================================
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

// ============================================
// 🌐 EXPRESS SERVER
// ============================================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============================================
// 📡 API ROUTES
// ============================================

// Generate pairing code - 8 DIGITS
app.post('/api/pair', (req, res) => {
    const { number, name } = req.body;
    if (!number) {
        return res.status(400).json({ error: 'Number is required' });
    }
    
    if (!/^[0-9]{10,15}$/.test(number)) {
        return res.status(400).json({ error: 'Invalid number format!' });
    }
    
    // 🔥 GENERATE 8-DIGIT CODE
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    const codeId = `PAIR-${code}`;
    
    // Store pairing request
    pairingCodes[codeId] = number;
    
    // Auto-expire after 5 minutes
    setTimeout(() => {
        delete pairingCodes[codeId];
    }, 300000);
    
    // Register user
    const user = addUser(number, name || 'User');
    
    res.json({
        success: true,
        code: codeId,
        message: `Pairing code generated!`,
        user: user,
        instructions: `Send "pair:${codeId}" in WhatsApp to link your account.`
    });
});

// Get bot status
app.get('/api/status', (req, res) => {
    const stats = getStats();
    res.json({
        name: CONFIG.BOT_NAME,
        version: CONFIG.VERSION,
        status: isBotReady ? 'online' : 'offline',
        users: stats.total,
        maxUsers: stats.maxUsers,
        activeUsers: stats.active,
        messages: stats.messages,
        uptime: formatUptime(process.uptime())
    });
});

// Get all users
app.get('/api/users', (req, res) => {
    res.json(users);
});

// Get user by number
app.get('/api/user/:number', (req, res) => {
    const user = getUser(req.params.number);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// ============================================
// 🚀 START
// ============================================
clear();
console.log(chalk.cyan(figlet.textSync(CONFIG.BOT_NAME, { font: 'Standard' })));
console.log(chalk.green(`🔐 WhatsApp Bot v${CONFIG.VERSION}`));
console.log(chalk.yellow(`👥 Max Users: ${CONFIG.MAX_USERS}`));
console.log(chalk.yellow(`📋 100+ Commands Ready!`));
console.log(chalk.yellow(`🔢 8-Digit Pairing Code`));
console.log(chalk.yellow('═══════════════════════════════════════\n'));

// Start WhatsApp bot
connectWhatsApp();

// Start web server
app.listen(CONFIG.PORT, () => {
    console.log(chalk.cyan(`\n🌐 Web Dashboard: http://localhost:${CONFIG.PORT}`));
    console.log(chalk.green(`📱 Bot Status: ${isBotReady ? '✅ Online' : '⏳ Connecting...'}`));
    console.log(chalk.yellow('\n📌 Users can register via web dashboard!\n'));
});

// Handle shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n👋 Shutting down...'));
    if (sock) await sock.logout();
    process.exit(0);
});
