const express = require('express');
const line = require('@line/bot-sdk');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const app = express();
const client = new line.Client(config);

let lastWelcomeSentAt = 0;
const WELCOME_INTERVAL_MS = 5 * 1000;

// Webhook สำหรับ LINE
app.post('/webhook', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

// Handle event ต่างๆ
async function handleEvent(event) {
  if (!event.replyToken) return Promise.resolve(null);

  // สมาชิกเข้ากลุ่ม
  if (event.type === 'memberJoined') {
    const now = Date.now();
    if (now - lastWelcomeSentAt < WELCOME_INTERVAL_MS) {
      console.log('ข้ามการตอบ เพราะส่งไปเมื่อไม่นานนี้');
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
        text: `📌 พี่ๆกรอกข้อมูลสำคัญให้เรสหน่อยน้า ที่ลิงก์นี้ 👇\nhttps://forms.gle/gXcRn9nyWiSxEp8E7\nเรสจะเก็บข้อมูลไว้ทำประกันและ Take Care พี่ๆ 💚\n\nถ้าพี่ท่านไหนไม่สะดวกกรอกทางลิงก์ที่เรสแจ้ง\nทักส่วนตัวหาพี่ใบตอง พี่ใหม่ หรือพี่ปอได้ฮะ`
      },
      {
        type: 'image',
        originalContentUrl: 'https://i.imgur.com/g8mt5OP.jpeg',
        previewImageUrl: 'https://i.imgur.com/g8mt5OP.jpeg'
      }
    ];

    return client.replyMessage(event.replyToken, welcomeMessages);
  }

  // ข้อความจากผู้ใช้
  if (event.type === 'message' && event.message.type === 'text') {
    const userMessage = event.message.text.toLowerCase();

    if (userMessage.includes('เรสมาลาพี่ๆ')) {
      const replyMessages = [
        {
          type: 'text',
          text: `เรสมาลาพี่ๆ \nขอบคุณ❤️พี่ๆทุกท่านที่เลือกเดินทางกับเพจเที่ยวกับเพื่อน Journey with friends\nให้พี่สตาฟได้ดูแลและเดินทางด้วยในครั้งนี้ฮะ\n\nเรสขอรบกวนพี่ทำแบบประเมินให้หน่อยฮะ ลิงก์นี้ 👇\nhttps://forms.gle/dxqYAu2Mg5VSjyLL8\nเรสจะนำไปเป็นกำลังใจและปรับปรุงทริปถัดไป 🦦🙏`
        },
        {
          type: 'text',
          text: `สุดท้ายขออนุญาตฝากช่องทาง ติดตามทริปสนุกๆได้อีกค้าบบ🙏\n\nFacebook\nhttps://www.facebook.com/share/18yHSFRJqu/\nTiktok\nhttps://www.tiktok.com/@withfriends81?_t=ZS-8tfHqKHDF8y&_r=1\nInstagram\nhttps://www.instagram.com/journeywithfriends.official?igsh=OW94bDk4bjJicm1h\nOpenChat\nhttps://line.me/ti/g2/rXXHCjIASRf_-NG86jcF7vdWUKid1ggcGiufqQ?utm_source=invitation&utm_medium=link_copy&utm_campaign=default`
        }
      ];

      return client.replyMessage(event.replyToken, replyMessages);
    }
  }

  return Promise.resolve(null);
}

// ➕ เพิ่ม route สำหรับ UptimeRobot
app.get('/ping', (req, res) => {
  res.send('OK');
});

// เริ่มต้นเซิร์ฟเวอร์
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`LINE bot listening on port ${port}`);
});
