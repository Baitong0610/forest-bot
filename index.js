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

// --- ดึงชื่อกลุ่ม หรือ fallback เป็น groupId ---
async function getSheetNameFromGroup(groupId) {
  try {
    console.log('📥 กำลังดึงชื่อกลุ่มจาก groupId:', groupId);
    const summary = await client.getGroupSummary(groupId);
    console.log('✅ groupName ที่ได้:', summary.groupName);
    return sanitizeSheetName(summary.groupName, groupId);
  } catch (err) {
    console.warn('⚠️ ดึงชื่อกลุ่มไม่ได้ ใช้ groupId แทน:', err.message);
    return groupId;
  }
}

// --- ตรวจสอบ/สร้างชีต ---
async function ensureSheetExists(sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
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
    const sheetName = await getSheetNameFromGroup(groupId);
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

// --- Get Seats ---
app.get('/seats', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ message: '❌ groupId is required' });

  try {
    const sheetName = await getSheetNameFromGroup(groupId);
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

// --- Start Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest Bot is running on port ${port}`);
});

