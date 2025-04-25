const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

app.use(express.json()); // ✅ ให้รองรับ JSON body

// ✅ Route สำหรับเช็คว่า server online
app.get('/', (req, res) => {
  res.send('OK');
});

// ✅ จำลองเก็บข้อมูลที่นั่ง (ในตัวแปรก่อน ใช้จริงค่อยใช้ DB)
const reservations = {};

// ✅ POST /reserve
app.post('/reserve', (req, res) => {
  const { seat, name, groupId } = req.body;

  if (!seat || !name) {
    return res.status(400).json({ status: 'error', message: 'ต้องกรอก seat และ name' });
  }

  if (reservations[seat]) {
    return res.status(409).json({ status: 'error', message: `ที่นั่ง ${seat} มีคนจองแล้ว` });
  }

  reservations[seat] = { name, groupId };
  return res.json({ status: 'success', message: `จองที่นั่ง ${seat} สำเร็จ` });
});

// ✅ Webhook จาก LINE
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

async function handleEvent(event) {
  if (!event.replyToken) return;

  if (event.type === 'memberJoined') {
    const now = Date.now();
    if (now - lastWelcomeSentAt < WELCOME_INTERVAL_MS) return;

    lastWelcomeSentAt = now;
    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: `สวัสดีฮะ พี่ๆ นักท่องเที่ยวที่เพิ่งเข้ามา\nผมชื่อ Forest หรือเรียก Rest ก็ได้ฮะ ผมเป็นตัวแทนของ เพจเที่ยวกับเพื่อน ❤️`
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
    ]);
  }

  if (event.type === 'message' && event.message.type === 'text') {
    const userMessage = event.message.text.toLowerCase();
    if (userMessage.includes('เรสมาลาพี่ๆ')) {
      return client.replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `เรสมาลาพี่ๆ ขอบคุณที่เดินทางกับเพจเที่ยวกับเพื่อน ❤️\nทำแบบประเมินให้เรสได้นะ 👇\nhttps://forms.gle/dxqYAu2Mg5VSjyLL8`
        }
      ]);
    }
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest bot running on port ${port}`);
});

