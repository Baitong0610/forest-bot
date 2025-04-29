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

const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'));
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

app.get('/', (req, res) => {
  res.send('Forest Bot is running.');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

app.post('/reserve', bodyParser.json(), async (req, res) => {
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

async function handleEvent(event) {
  // Your previous line event handler logic (welcome messages, etc.)
}

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
