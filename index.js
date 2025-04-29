const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const getRawBody = require('raw-body');
const { google } = require('googleapis');

const app = express();
app.use(cors());

// --- LINE Config ---
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(config);

// --- Google Sheets Auth ---
const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1XE07lRz6ZsXa6TELNH61I9pwsGXWfgmso3_2HxSFP60';

// --- Root Route ---
app.get('/', (req, res) => {
  res.send('🌳 Forest Bot is running!');
});

// --- LINE Webhook ---
app.post('/webhook', (req, res, next) => {
  getRawBody(req)
    .then((buf) => {
      req.rawBody = buf;
      next();
    })
    .catch((err) => {
      console.error('❌ Raw body error:', err);
      res.status(400).send('Invalid body');
    });
}, line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error('❌ Error in /webhook:', error);
    res.status(500).end();
  }
});

// --- Reserve Seat ---
app.use(bodyParser.json()); // ใช้กับ route ทั่วไป

app.post('/reserve', async (req, res) => {
  const { userId, seatNumber, name, groupId } = req.body;

  if (!userId || !seatNumber || !groupId || !name) {
    return res.status(400).json({ message: '❌ Missing required fields' });
  }

  const sheetName = groupId;
  try {
    await ensureSheetExists(sheetName);
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, userId, seatNumber, name]],
      },
    });

    res.json({ status: 'success', message: '✅ Booking saved' });
  } catch (error) {
    console.error('❌ Error saving booking:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- Get All Seats ---
app.get('/seats', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ message: '❌ groupId is required' });

  const sheetName = groupId;
  try {
    await ensureSheetExists(sheetName);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:D`,
    });

    const rows = response.data.values || [];
    const seats = rows.map(row => ({
      timestamp: row[0],
      userId: row[1],
      seatNumber: row[2],
      name: row[3],
    }));

    res.json({ status: 'success', seats });
  } catch (error) {
    console.error('❌ Error loading seats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load seats' });
  }
});

// --- Ensure Sheet Exists ---
async function ensureSheetExists(sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = metadata.data.sheets.some(sheet => sheet.properties.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: { properties: { title: sheetName } }
        }]
      }
    });
  }
}

// --- LINE Event Handler ---
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

  if (event.type === 'follow') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ยินดีต้อนรับเข้าสู่ Forest Bot ครับ 🌳'
    });
  }
}

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest Bot is running on port ${port}`);
});
