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

// --- Google Sheets Setup ---
const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// Spreadsheet ID
const SPREADSHEET_ID = '1XE07lRz6ZsXa6TELNH61I9pwsGXWfgmso3_2HxSFP60';

// --- Home Route ---
app.get('/', (req, res) => {
  res.send('🌳 Forest Bot is running!');
});

// --- Webhook from LINE ---
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("❌ Error in /webhook:", err);
    res.status(500).end();
  }
});

// --- Reserve Seat ---
app.post('/reserve', bodyParser.json(), async (req, res) => {
  const { userId, seatNumber, groupId, name } = req.body;

  if (!userId || !seatNumber || !groupId || !name) {
    return res.status(400).json({ message: '❌ Missing data' });
  }

  try {
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reservations!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, groupId, userId, seatNumber, name]],
      },
    });

    res.json({ status: "success", message: "✅ Booking saved" });
  } catch (error) {
    console.error("❌ Error writing to Google Sheets:", error);
    res.status(500).json({ message: '❌ Failed to save booking' });
  }
});

// --- Get All Seats ---
app.get('/seats', async (req, res) => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Reservations!A:E',
    });

    const rows = response.data.values || [];
    const seatData = {};

    rows.forEach(row => {
      const seat = row[3];
      const name = row[4];
      if (seat && name) {
        seatData[seat] = name;
      }
    });

    res.json({ status: "success", seats: seatData });
  } catch (error) {
    console.error("❌ Error reading Google Sheets:", error);
    res.status(500).json({ status: "error", message: '❌ Failed to load seats' });
  }
});

// --- Event Handler ---
async function handleEvent(event) {
  if (!event || !event.type) return;

  if (!event.replyToken || event.replyToken === "00000000000000000000000000000000" || event.replyToken === "ffffffffffffffffffffffffffffffff") {
    return;
  }

  if (event.type === 'memberJoined') {
    const welcomeMessages = [
      {
        type: 'text',
        text: `สวัสดีฮะ พี่ๆ นักท่องเที่ยวที่เพิ่งเข้ามา\nผมชื่อ Forest หรือเรียก Rest ก็ได้ฮะ ผมเป็นตัวแทนของเพจเที่ยวกับเพื่อน ❤️`
      },
      {
        type: 'text',
        text: `📌 พี่ๆกรอกข้อมูลสำคัญให้เรสหน่อยน้า ที่ลิงก์นี้ 👇\nhttps://forms.gle/gXcRn9nyWiSxEp8E7`
      }
    ];
    return client.replyMessage(event.replyToken, welcomeMessages);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();
    if (msg.includes('จองที่นั่ง')) {
      const groupId = event.source.groupId || 'unknown';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📌 จองที่นั่งได้ที่นี่เลยฮะ 👇\nhttps://baitong0610.github.io/forest-bot/?group=${groupId}`
      });
    }
  }
}

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest bot running on port ${port}`);
});

