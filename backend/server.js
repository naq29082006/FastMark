require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { initFirebaseAdmin } = require('./config/firebaseAdmin');
const profileRoutes = require('./routes/profileRoutes');
const storeRoutes = require('./routes/storeRoutes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();
initFirebaseAdmin();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'Fastmark API',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    firebaseProject: process.env.FIREBASE_PROJECT_ID || 'fastmark-e881d',
  });
});

// Firebase Auth token required — user data in MongoDB
app.use('/profile', profileRoutes);

// Public read — store/product/review data in MongoDB
app.use('/api', storeRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Fastmark API running on port ${PORT}`);
});
