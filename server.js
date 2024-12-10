const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const path = require('path');

// إعداد الخادم
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// إعداد الاتصال بقاعدة بيانات MySQL
const connection = mysql.createConnection({
  host: 'localhost',       // اسم الخادم
  user: 'root',            // اسم المستخدم
  password: '',            // كلمة المرور
  database: 'messageApp'   // اسم قاعدة البيانات
});

// الاتصال بقاعدة البيانات
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// مسار عرض صفحة HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // تأكد من وجود ملف index.html في نفس المجلد
});

// استماع للاتصال عبر Socket.IO
let users = {}; // لتخزين حالة الاتصال للمستخدمين

io.on('connection', (socket) => {
    console.log('A user connected');
  
    // حفظ حالة اتصال المستخدم
    socket.on('setUsername', (username) => {
      users[username] = socket.id;
      console.log(`${username} is connected`);
  
      // جلب الرسائل المخزنة في قاعدة البيانات
      connection.query('SELECT * FROM messages WHERE user = ? ORDER BY createdAt DESC LIMIT 10', [username], (err, results) => {
        if (err) {
          console.error('Error fetching messages:', err);
          return;
        }
        socket.emit('receiveMessages', results); // إرسال الرسائل المخزنة للمستخدم
      });
    });
  
    // استقبال رسالة جديدة
    socket.on('sendMessage', (data) => {
      const { username, message } = data;
  
      // تخزين الرسالة في قاعدة البيانات
      connection.query('INSERT INTO messages (user, message) VALUES (?, ?)', [username, message], (err, results) => {
        if (err) {
          console.error('Error saving message:', err);
          return;
        }
  
        // التحقق إذا كان المستخدم متصلًا
        if (users[username]) {
          // إذا كان متصلًا، يتم إرسال الرسالة مباشرة
          io.to(users[username]).emit('receiveMessage', { user: username, message });
        } else {
          // إذا لم يكن متصلًا، يتم تنفيذ كود معين
          console.log(`User ${username} is offline. Message saved in the database.`);
          
          // هنا يمكنك إضافة كود إضافي، مثل إرسال إشعار بالبريد الإلكتروني أو تسجيل الحدث في السجلات.
        }
      });
    });
  
    // عند قطع الاتصال
    socket.on('disconnect', () => {
      const disconnectedUser = Object.keys(users).find(key => users[key] === socket.id);
      if (disconnectedUser) {
        delete users[disconnectedUser];
        console.log(`${disconnectedUser} has disconnected`);
      }
    });

  });

// تشغيل الخادم على المنفذ 3000
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
