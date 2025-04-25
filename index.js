const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// LINE Bot Configuration
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(config);

// Root route
app.get('/', (req, res) => {
  console.log("✅ GET / hit!");
  res.send('🌳 Forest Bot is running!');
});

// Reserve route (from frontend)
app.post('/reserve', (req, res) => {
  const { userId, seatNumber, contextId } = req.body;

  if (!userId || !seatNumber || !contextId) {
    return res.status(400).json({ message: 'Missing userId, seatNumber, or contextId' });
  }

  console.log(`🪑 จองที่นั่ง: userId=${userId}, seat=${seatNumber}, contextId=${contextId}`);
  res.json({ message: `จองที่นั่ง ${seatNumber} สำเร็จในกลุ่ม ${contextId}` });
});

// Webhook route
let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).end();
  }
});

// Handle all LINE events
async function handleEvent(event) {
  if (!event.replyToken) return;

  // Welcome message when member joins group
  if (event.type === 'memberJoined') {
    const now = Date.now();
    if (now - lastWelcomeSentAt < WELCOME_INTERVAL_MS) return;
    lastWelcomeSentAt = now;

    const welcomeMessages = [
      {
        type: 'text',
        text: `สวัสดีฮะ พี่ๆ นักท่องเที่ยวที่เพิ่งเข้ามา\nผมชื่อ Forest หรือเรียก Rest ก็ได้ฮะ ผมเป็นตัวแทนของ เพจเที่ยวกับเพื่อน ❤️`
      },
      {
        type: 'text',
        text: `📌 พี่ๆกรอกข้อมูลสำคัญให้เรสหน่อยน้า ที่ลิงก์นี้ 👇\nhttps://forms.gle/gXcRn9nyWiSxEp8E7\nเรสจะเก็บข้อมูลไว้ทำประกันและ Take Care พี่ๆ 💚`
      },
      {
        type: 'image',
        originalContentUrl: 'https://i.imgur.com/g8mt5OP.jpeg',
        previewImageUrl: 'https://i.imgur.com/g8mt5OP.jpeg'
      }
    ];

    return client.replyMessage(event.replyToken, welcomeMessages);
  }

  // Text message
  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();

    // คำว่า "เรสมาลาพี่ๆ"
    if (msg.includes('เรสมาลาพี่ๆ')) {
      const byeMessages = [
        {
          type: 'text',
          text: `เรสมาลาพี่ๆ \nขอบคุณ❤️พี่ๆทุกท่านที่เลือกเดินทางกับเพจเที่ยวกับเพื่อน Journey with friends\nให้พี่สตาฟได้ดูแลและเดินทางด้วยในครั้งนี้ฮะ\n\nเรสขอรบกวนพี่ทำแบบประเมินให้หน่อยฮะ ลิงก์นี้ 👇\nhttps://forms.gle/dxqYAu2Mg5VSjyLL8`
        },
        {
          type: 'text',
          text: `สุดท้ายขออนุญาตฝากช่องทาง ติดตามทริปสนุกๆได้อีกค้าบบ🙏\n\nFacebook\nhttps://www.facebook.com/share/18yHSFRJqu/\nTiktok\nhttps://www.tiktok.com/@withfriends81?_t=ZS-8tfHqKHDF8y&_r=1\nInstagram\nhttps://www.instagram.com/journeywithfriends.official?igsh=OW94bDk4bjJicm1h\nOpenChat\nhttps://line.me/ti/g2/rXXHCjIASRf_-NG86jcF7vdWUKid1ggcGiufqQ?utm_source=invitation&utm_medium=link_copy&utm_campaign=default`
        }
      ];

      return client.replyMessage(event.replyToken, byeMessages);
    }

    // คำว่า "จองที่นั่ง"
    if (msg.includes('จองที่นั่ง')) {
      const userId = event.source.userId;
      const contextId = event.source.groupId || event.source.roomId || 'unknown';
      const bookingUrl = `https://baitong0610.github.io/forest-bot/?userId=${userId}&contextId=${contextId}`;
      const reply = {
        type: 'text',
        text: `🌲 จองที่นั่งได้ที่นี่เลยฮะ: ${bookingUrl}`
      };
      return client.replyMessage(event.replyToken, reply);
    }
  }
}

// Start server
const port = process.env.PORT || 3000;
console.log("🟢 Starting server on port:", port);
app.listen(port, () => {
  console.log(`🌳 Forest bot running on port ${port}`);
});
