import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processFileStream } from './streamProcessor';

const router = Router();

// --- 1. Where are files stored? ---
// Standard practice is to store them on a disk in a dedicated directory.
// For large-scale apps, you would upload them to cloud storage like AWS S3.
// Here, we store them locally in the 'uploads' folder.
const uploadDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// --- 2. File Organization ---
// Multer Disk Storage configures how files are saved.
// It's crucial to rename files to avoid overwriting and security risks.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Files are saved into the 'uploads' directory
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // We prepend a unique timestamp to organize and avoid name collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Multer middleware setup
const upload = multer({ storage });

// POST endpoint to handle multiple file uploads
// 'documents' is the name of the field in our HTML form
router.post('/upload', upload.array('documents', 10), async (req, res) => {
  // When using .array(), the files are found in req.files (an array)
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    // We process all uploaded files concurrently
    const results = await Promise.all(files.map(async (file) => {
      const compressedPath = file.path + '.gz';
      const fileStats = await processFileStream(file.path, compressedPath);

      // --- DEDUPLICATION (Checking if file already exists) ---
      // We check all existing metadata files to see if this exact MD5 hash was already uploaded
      const existingFiles = fs.readdirSync(uploadDir).filter(f => f.endsWith('.json'));
      let isDuplicate = false;
      let duplicateMeta = null;

      for (const metaFile of existingFiles) {
        const content = fs.readFileSync(path.join(uploadDir, metaFile), 'utf-8');
        const meta = JSON.parse(content);
        if (meta.md5Hash === fileStats.md5Hash) {
          isDuplicate = true;
          duplicateMeta = meta;
          break;
        }
      }

      if (isDuplicate) {
        // If it's a duplicate, we delete BOTH the newly uploaded original AND the newly compressed file
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);

        return duplicateMeta; // Just return the info for the file that already exists!
      }

      // If it's NOT a duplicate, we proceed to save the new metadata
      const metadata = {
        originalName: file.originalname,
        savedAs: file.filename,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
        ...fileStats
      };

      // Save metadata to a JSON file so we don't lose it on refresh!
      fs.writeFileSync(compressedPath + '.json', JSON.stringify(metadata, null, 2));

      // We don't need the original uncompressed file anymore, so we delete it to save space!
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return metadata;
    }));

    // Returning the array of results to the client
    res.json({
      message: 'Files uploaded, processed, and compressed successfully!',
      results: results
    });
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(500).json({ error: 'Error processing file streams' });
  }
});

// GET endpoint to download the compressed file
router.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const originalName = req.query.originalName as string;

  // Basic security check to prevent directory traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(uploadDir, filename);

  if (fs.existsSync(filePath)) {
    // Express provides a handy res.download helper, but under the hood, 
    // it uses streams (fs.createReadStream) to send the file to the client!

    // If the client provided the originalName query parameter, we construct the download name
    const downloadName = originalName ? originalName + '.gz' : filename;

    res.download(filePath, downloadName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).send('Error downloading file');
        }
      }
    });
  } else {
    res.status(404).send('File not found');
  }
});

// GET endpoint to fetch all previously uploaded files
router.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadDir);
    const metadataFiles = files.filter(f => f.endsWith('.json'));

    const results = metadataFiles.map(file => {
      const content = fs.readFileSync(path.join(uploadDir, file), 'utf-8');
      return JSON.parse(content);
    });

    // Send the array of past files
    res.json(results);
  } catch (error) {
    console.error("Error fetching past files:", error);
    res.status(500).json({ error: 'Failed to load past files' });
  }
});

export { router as uploadRouter };
