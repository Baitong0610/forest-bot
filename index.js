const express = require('express');
const line = require('@line/bot-sdk');

// 🛠️ LINE Bot config
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Test route
app.get('/', (req, res) => {
  res.send('OK');
});

// ✅ Memory-based booking store (จำข้อมูลไว้ชั่วคราว รีสตาร์ทแล้วหาย)
const bookedSeats = {};

// ✅ Seat reservation route
app.post('/reserve', (req, res) => {
  const { seat, name, groupId } = req.body;

  if (!seat || !name) {
    return res.status(400).json({ status: "error", message: "ข้อมูลไม่ครบ" });
  }

  if (bookedSeats[seat]) {
    return res.json({ status: "error", message: `ที่นั่ง ${seat} ถูกจองไปแล้ว` });
  }

  bookedSeats[seat] = { name, groupId };
  return res.json({ status: "success", message: `จองที่นั่ง ${seat} สำเร็จ` });
});

// ✅ LINE Webhook
let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (!event.replyToken) return Promise.resolve(null);

  // ✅ ต้อนรับสมาชิกใหม่
  if (event.type === 'memberJoined') {
    const now = Date.now();
    if (now - lastWelcomeSentAt < WELCOME_INTERVAL_MS) {
      return;
    }
    lastWelcomeSentAt = now;

    const welcomeMessages = [
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
    ];

    return client.replyMessage(event.replyToken, welcomeMessages);
  }

  // ✅ ตอบข้อความ
  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();

    if (msg.includes('เรสมาลาพี่ๆ')) {
      const reply = [
        {
          type: 'text',
          text: `เรสมาลาพี่ๆ \nขอบคุณ❤️พี่ๆทุกท่านที่เลือกเดินทางกับเพจเที่ยวกับเพื่อน Journey with friends`
        },
        {
          type: 'text',
          text: `สุดท้ายขออนุญาตฝากช่องทาง ติดตามทริปสนุกๆได้อีกค้าบบ 🙏\nFacebook: https://www.facebook.com/share/18yHSFRJqu/\nTiktok: https://www.tiktok.com/@withfriends81\nIG: https://www.instagram.com/journeywithfriends.official`
        }
      ];
      return client.replyMessage(event.replyToken, reply);
    }
  }

  return Promise.resolve(null);
}

// ✅ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LINE bot + seat reservation running on port ${port}`);
});
