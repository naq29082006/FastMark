const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const storeRoutes = require('./routes/storeRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const productRoutes = require('./routes/productRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const walletRoutes = require('./routes/walletRoutes');
const walletController = require('./controllers/walletController');
const asyncHandler = require('./utils/asyncHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'Fastmark API',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    firebaseProject: process.env.FIREBASE_PROJECT_ID || 'fastmark-e881d',
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, message: 'OK' });
});

app.use('/api/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/banners', require('./routes/bannerRoutes'));
app.post('/api/webhooks/payos', asyncHandler(walletController.payosWebhook));
app.use('/api', storeRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API not found',
  });
});

app.use(errorHandler);

module.exports = app;
