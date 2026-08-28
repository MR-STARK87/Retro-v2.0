import express from 'express';
import { getMusicList, streamMusic, getMusicInfo } from '../controllers/musicController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/music
 * @desc    Get list of all available music files
 * @access  Public
 */
router.get('/', getMusicList);

/**
 * @route   GET /api/v1/music/stream/:filename
 * @desc    Stream a specific music file (supports range requests for seeking)
 * @access  Public
 */
router.get('/stream/:filename', streamMusic);

/**
 * @route   GET /api/v1/music/info/:filename
 * @desc    Get information about a specific music file
 * @access  Public
 */
router.get('/info/:filename', getMusicInfo);

export default router;
