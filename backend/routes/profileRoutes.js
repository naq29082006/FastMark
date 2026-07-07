const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireFirebaseAuth } = require('../middleware/authFirebase');
const { getProfile, updateProfile } = require('../controllers/profileController');

const router = express.Router();

router.get('/', requireFirebaseAuth, asyncHandler(getProfile));
router.put('/', requireFirebaseAuth, asyncHandler(updateProfile));

module.exports = router;
