const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');

const app = express();
app.use(cors());

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// Google Sheets Auth
const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1XE07lRz6ZsXa6TELNH61I9pwsGXWfgmso3_2HxSFP60';

// Home route
app.get('/', (req, res) => {
  res.send('🌳 Forest Bot is running!');
});

// LINE Webhook
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("❌ Error in /webhook:", err);
    res.status(500).end();
  }
});

// Seat Reservation
app.post('/reserve', bodyParser.json(), async (req, res) => {
  const { userId, seatNumber, groupId, name } = req.body;

  if (!userId || !seatNumber || !groupId || !name) {
    return res.status(400).json({ message: '❌ Missing data (userId, seatNumber, name, groupId)' });
  }

  console.log(`📌 Group ${groupId}: ${name} (${userId}) จองที่นั่ง ${seatNumber}`);

  try {
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reservations!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, groupId, userId, name, seatNumber]],
      },
    });

    res.json({ message: `✅ จองที่นั่ง ${seatNumber} เรียบร้อย` });
  } catch (error) {
    console.error("❌ Google Sheets Error:", error);
    res.status(500).json({ message: '❌ บันทึกข้อมูลไม่สำเร็จ' });
  }
});

// Handle LINE events
let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

async function handleEvent(event) {
  if (!event || !event.type) return;

  if (event.type === 'memberJoined') {
    const now = Date.now();
    if (now - lastWelcomeSentAt < WELCOME_INTERVAL_MS) return;
    lastWelcomeSentAt = now;

    const welcomeMessages = [
      {
        type: 'text',
        text: `สวัสดีฮะ พี่ๆ นักท่องเที่ยวที่เพิ่งเข้ามา\nผมชื่อ Forest หรือเรียก Rest ก็ได้ฮะ ผมเป็นตัวแทนของเพจเที่ยวกับเพื่อน ❤️`
      },
      {
        type: 'text',
        text: `📌 พี่ๆกรอกข้อมูลสำคัญให้เรสหน่อยน้า ที่ลิงก์นี้ 👇\nhttps://forms.gle/gXcRn9nyWiSxEp8E7`
      },
      {
        type: 'image',
        originalContentUrl: 'https://i.imgur.com/g8mt5OP.jpeg',
        previewImageUrl: 'https://i.imgur.com/g8mt5OP.jpeg'
      }
    ];
    return client.replyMessage(event.replyToken, welcomeMessages);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();
    if (msg.includes('เรสมาลาพี่ๆ')) {
      return client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `เรสมาลาพี่ๆ \nขอบคุณ❤️พี่ๆทุกท่านที่เลือกเดินทางกับเพจเที่ยวกับเพื่อน\n\nแบบประเมินทริป 👇\nhttps://forms.gle/dxqYAu2Mg5VSjyLL8`
        },
        {
          type: 'text',
          text: `ติดตามช่องทางของเราได้ที่ 👇\nFB: https://facebook.com/share/18yHSFRJqu/\nTiktok: https://www.tiktok.com/@withfriends81\nIG: https://instagram.com/journeywithfriends.official\nOpenChat: https://line.me/ti/g2/rXXHCjIASRf_-NG86jcF7vdWUKid1ggcGiufqQ`
        }
      ]);
    }

    if (msg.includes('จองที่นั่ง')) {
      const groupId = event.source.groupId || 'unknown';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📌 จองที่นั่งได้ที่นี่เลยฮะ 👇\nhttps://baitong0610.github.io/forest-bot/?groupId=${groupId}`
      });
    }
  }
}

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest bot running on port ${port}`);
});
