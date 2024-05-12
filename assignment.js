const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
// Express app
const app = express();

// Socket.io setup
const server = http.createServer(app);
const io = socketIO(server);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// MongoDB connection
mongoose.connect('mongodb://0.0.0.0:27017/node')
.then(()=>{
    console.log('Connected to MongoDB');
})
.catch(()=>{
    console.log('Error connecting to MongoDB');
})
// User model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  onlineStatus: { type: String, default: 'AVAILABLE' }
});

const User = mongoose.model('User', userSchema);



// JWT secret key
const secretKey = 'y-secret-key';

// Register route
app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const user = new User({ email, password });
    try {
      await user.save();
      res.send({ message: 'User created successfully' });
    } catch (err) {
      res.status(400).send({ message: 'Error creating user' });
    }
  });

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).send({ message: 'Invalid email or password' });
  } else {
    const isValid = await bcrypt.compare(password, user.password);
    if (isValid) {
      const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });
      res.send({ token });
    } else {
      res.status(401).send({ message: 'Invalid email or password' });
    }
  }
});

// Chat functionality
io.on('connection', (socket) => {
  console.log('New connection established');

  // Handle chat messages
  socket.on('message', async (data) => {
    const { senderId, recipientId, message } = data;
    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);
    if (recipient.onlineStatus === 'AVAILABLE') {
      // Send message to recipient
      io.emit('message', { senderId, recipientId, message });
    } else {
      // Generate response using LLM API
      const response = await getLLMResponse(message);
      io.emit('message', { senderId, recipientId, message: response });
    }
  });

  // Handle online status updates
  socket.on('update-online-status', async (data) => {
    const { userId, onlineStatus } = data;
    const user = await User.findById(userId);
    user.onlineStatus = onlineStatus;
    await user.save();
  });
});

// Mock LLM API response
async function getLLMResponse(prompt) {
  return new Promise((resolve) => {
    const timeout = Math.random() * (15000 - 5000) + 5000;
    setTimeout(() => {
      resolve('This is a mock response from the LLM based on user input');
    }, timeout);
  });
}

server.listen(4000, () => {
  console.log('Server listening on port 4000');
});