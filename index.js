const express = require('express');
const line = require('@line/bot-sdk');
const cors = require('cors');
const bodyParser = require('body-parser'); // ใช้เฉพาะ /reserve

const app = express();
app.use(cors());

// ✅ LINE SDK config
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// ✅ GET: หน้าหลัก ให้ Render ตรวจสุขภาพเซิร์ฟเวอร์
app.get('/', (req, res) => {
  console.log("✅ GET / hit!");
  res.send('🌳 Forest Bot is running!');
});

// ✅ POST: webhook จาก LINE (ต้องมาก่อน bodyParser.json)
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error("❌ Error in /webhook:", err);
    res.status(500).end();
  }
});

// ✅ POST: สำหรับจองที่นั่ง (ใช้ bodyParser แบบ json ได้)
app.post('/reserve', bodyParser.json(), async (req, res) => {
  const { userId, seatNumber, groupId } = req.body;

  if (!userId || !seatNumber || !groupId) {
    return res.status(400).json({ message: '❌ Missing userId, seatNumber, or groupId' });
  }

  console.log(`📌 Group ${groupId}: User ${userId} จองที่นั่งหมายเลข ${seatNumber}`);

  // 🔜 ต่อไปจะเพิ่มระบบบันทึก Google Sheets ตรงนี้

  res.json({ message: `✅ จองที่นั่ง ${seatNumber} เรียบร้อยในกลุ่ม ${groupId}` });
});


// ✅ Handler: ตอบกลับเมื่อสมาชิกเข้ากลุ่ม หรือพิมพ์ข้อความ
let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

async function handleEvent(event) {
  if (!event.replyToken) return;

  // ✅ ต้อนรับสมาชิกใหม่
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

  // ✅ ตอบกลับเมื่อพิมพ์บางคำ
  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();

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
  }
}

// ✅ Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🌳 Forest bot running on port ${port}`);
});
