const { initFirebaseAdmin } = require('../config/firebaseAdmin');

async function requireFirebaseAuth(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Thiếu Bearer token. Đăng nhập Firebase trước.' });
  }

  const idToken = header.slice('Bearer '.length).trim();

  if (!idToken) {
    return res.status(401).json({ error: 'Token rỗng.' });
  }

  try {
    const admin = initFirebaseAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token không hợp lệ hoặc đã hết hạn.',
      code: error.code || 'auth/invalid-token',
    });
  }
}

module.exports = { requireFirebaseAuth };
