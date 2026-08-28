import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the music directory path
const MUSIC_DIR = path.join(__dirname, '../../public/music');

/**
 * Get list of all music files in the music directory
 */
export const getMusicList = async (req, res) => {
  try {
    // Check if music directory exists
    if (!fs.existsSync(MUSIC_DIR)) {
      fs.mkdirSync(MUSIC_DIR, { recursive: true });
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Music directory created. Add MP3 files to start streaming.',
      });
    }

    // Read all files from music directory
    const files = fs.readdirSync(MUSIC_DIR);

    // Filter only MP3 files and exclude incomplete downloads
    const musicFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return (ext === '.mp3' || ext === '.wav' || ext === '.ogg') &&
               !file.includes('.crdownload') &&
               !file.startsWith('.');
      })
      .map(file => {
        const filePath = path.join(MUSIC_DIR, file);
        const stats = fs.statSync(filePath);

        return {
          id: Buffer.from(file).toString('base64'), // Create a unique ID
          filename: file,
          title: path.parse(file).name, // Remove extension for display
          url: `/music/${encodeURIComponent(file)}`,
          size: stats.size,
          duration: null, // Can be calculated on frontend
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically

    res.status(200).json({
      success: true,
      count: musicFiles.length,
      data: musicFiles,
    });
  } catch (error) {
    console.error('Error getting music list:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve music list',
      error: error.message,
    });
  }
};

/**
 * Stream a specific music file
 */
export const streamMusic = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(MUSIC_DIR, filename);

    // Security check: prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(MUSIC_DIR)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Music file not found',
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'audio/mpeg';
    if (ext === '.wav') contentType = 'audio/wav';
    if (ext === '.ogg') contentType = 'audio/ogg';

    if (range) {
      // Handle range requests for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // Stream entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
      };

      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming music:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stream music',
      error: error.message,
    });
  }
};

/**
 * Get info about a specific music file
 */
export const getMusicInfo = async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(MUSIC_DIR, filename);

    // Security check
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(MUSIC_DIR)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Music file not found',
      });
    }

    const stats = fs.statSync(filePath);

    res.status(200).json({
      success: true,
      data: {
        filename: filename,
        title: path.parse(filename).name,
        size: stats.size,
        modified: stats.mtime,
        url: `/music/${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error getting music info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get music info',
      error: error.message,
    });
  }
};
