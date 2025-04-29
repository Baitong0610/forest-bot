const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
const bodyParser = require('body-parser');
const getRawBody = require('raw-body'); // สำคัญ
const { google } = require('googleapis');

const app = express();
app.use(cors());

// LINE Bot Config
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};
const client = new line.Client(config);

// Google Sheets Auth
const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Root route
app.get('/', (req, res) => {
  res.send('Forest Bot is running.');
});

// ✅ LINE Webhook with raw body
app.post('/webhook', (req, res, next) => {
  getRawBody(req)
    .then((buf) => {
      req.rawBody = buf;
      next();
    })
    .catch((err) => {
      console.error('Raw body error:', err);
      res.status(400).send('Invalid body');
    });
}, line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

// ✅ ต้องใช้ bodyParser กับ API ทั่วไปเท่านั้น
app.use(bodyParser.json());

// API จองที่นั่ง
app.post('/reserve', async (req, res) => {
  const { userId, seatNumber, name, groupId } = req.body;

  if (!userId || !seatNumber || !groupId || !name) {
    return res.status(400).json({ message: 'Missing required fields' });
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
        values: [[timestamp, userId, seatNumber, name]]
      }
    });

    res.json({ status: 'success' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// API ดูที่นั่งทั้งหมด
app.get('/seats', async (req, res) => {
  const { groupId } = req.query;
  if (!groupId) return res.status(400).json({ message: 'groupId required' });

  const sheetName = groupId;

  try {
    await ensureSheetExists(sheetName);

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:D`
    });

    const rows = result.data.values || [];
    const data = rows.map(row => ({
      timestamp: row[0],
      userId: row[1],
      seatNumber: row[2],
      name: row[3]
    }));

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch seats' });
  }
});

// ฟังก์ชันสร้างชีตหากยังไม่มี
async function ensureSheetExists(sheetName) {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metadata.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    });
  }
}

// Placeholder สำหรับ handleEvent
async function handleEvent(event) {
  // เพิ่ม logic ต้อนรับ หรือคำสั่งต่างๆ ที่ต้องการ
  if (event.type === 'follow') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'ยินดีต้อนรับเข้าสู่ Forest Bot ครับ 🌳'
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
