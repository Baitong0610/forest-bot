const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
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
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// --- Helper: ปลอดภัยสำหรับชื่อชีต ---
function sanitizeSheetName(name, fallbackId) {
  const safeName = name.replace(/[\\/?*[\]]/g, '').slice(0, 90);
  const suffix = fallbackId ? '-' + fallbackId.slice(-5) : '';
  return (safeName + suffix).slice(0, 100);
}

// --- ตรวจสอบ/สร้างชีต ---
async function ensureSheetExists() {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetName = "seats"; // ใช้ชื่อชีตเดียวสำหรับเก็บข้อมูลทั้งหมด
  const exists = metadata.data.sheets.some(sheet => sheet.properties.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      }
    });
  }
}

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

// --- LINE Event Handler ---
async function handleEvent(event) {
  if (!event || !event.type) return;
  if (!event.replyToken || event.replyToken.match(/^0+|f+$/i)) return;

  if (event.type === 'memberJoined') {
    return client.replyMessage(event.replyToken, [
      { type: 'text', text: `สวัสดีฮะ ผมคือ Forest Bot 🌳 ยินดีต้อนรับครับ` },
      { type: 'text', text: `📌 พี่ๆกรอกข้อมูลได้ที่นี่เลยครับ 👇\nhttps://forms.gle/gXcRn9nyWiSxEp8E7` },
    ]);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();
    if (msg.includes('จองที่นั่ง')) {
      const groupId = event.source.groupId || 'unknown';
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📌 จองที่นั่งได้ที่นี่เลยครับ 👇\nhttps://baitong0610.github.io/forest-bot/?group=${groupId}`
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

// --- Reserve Seat ---
app.post('/reserve', express.json(), async (req, res) => {
  const { userId, seatNumber, name, groupId } = req.body;
  if (!userId || !seatNumber || !groupId || !name) {
    return res.status(400).json({ message: '❌ Missing required fields' });
  }

  try {
    const sheetName = "seats"; // ใช้ชื่อชีตเดียว
    await ensureSheetExists();

    const timestamp = new Date().toISOString();
    const row = [timestamp, groupId, userId, seatNumber, name]; // เพิ่มข้อมูล groupId ลงไปด้วย

    // เพิ่มข้อมูลใหม่ลงในชีต
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,  // เพิ่มข้อมูลในชีตเดียว
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    res.json({ status: 'success', message: '✅ Booking saved' });
  } catch (error) {
    console.error('❌ Error saving booking:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// --- Get Seats ---
app.get('/seats', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ message: '❌ groupId is required' });

  try {
    const sheetName = "seats"; // ใช้ชื่อชีตเดียว
    await ensureSheetExists();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:E`,  // ดึงข้อมูลทั้งหมดในชีต
    });

    const rows = response.data.values || [];
    const seats = rows.filter(row => row[1] === groupId).map(row => ({  // กรองข้อมูลตาม groupId
      timestamp: row[0],
      groupId: row[1],
      userId: row[2],
      seatNumber: row[3],
      name: row[4],
    }));

    res.json({ status: 'success', seats });
  } catch (error) {
    console.error('❌ Error loading seats:', error);
    res.status(500).json({ status: 'error', message: 'Failed to load seats' });
  }
});

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest Bot is running on port ${port}`);
});
