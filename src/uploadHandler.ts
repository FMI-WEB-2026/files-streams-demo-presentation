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
(async () => {
  try {
    await fs.promises.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Error creating upload directory:", err);
  }
})();

// --- 2. File Organization ---
// Multer Disk Storage configures how files are saved.
// It's crucial to rename files to avoid overwriting and security risks.
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Files are saved into the 'uploads' directory, organized by Year/Month/Day
      const date = new Date();
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      const dynamicDir = path.join(uploadDir, year, month, day);
      // mkdir with recursive: true automatically ignores if the directory already exists
      await fs.promises.mkdir(dynamicDir, { recursive: true });

      cb(null, dynamicDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    // We prepend a unique timestamp to organize and avoid name collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Multer middleware setup
const upload = multer({ storage });

// Helper function to recursively find all JSON files in the uploads directory asynchronously
async function getAllJsonFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  try {
    await fs.promises.access(dir);
  } catch {
    return fileList; // Directory doesn't exist
  }

  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.promises.stat(fullPath);
    if (stat.isDirectory()) {
      await getAllJsonFiles(fullPath, fileList);
    } else if (file.endsWith('.json')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

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
      const existingFiles = await getAllJsonFiles(uploadDir);
      let isDuplicate = false;
      let duplicateMeta = null;

      for (const metaFilePath of existingFiles) {
        const content = await fs.promises.readFile(metaFilePath, 'utf-8');
        const meta = JSON.parse(content);
        if (meta.md5Hash === fileStats.md5Hash) {
          isDuplicate = true;
          duplicateMeta = meta;
          break;
        }
      }

      if (isDuplicate) {
        // If it's a duplicate, we delete BOTH the newly uploaded original AND the newly compressed file
        await fs.promises.unlink(file.path).catch(() => { });
        await fs.promises.unlink(compressedPath).catch(() => { });

        return duplicateMeta; // Just return the info for the file that already exists!
      }

      // If it's NOT a duplicate, we proceed to save the new metadata
      // Calculate relative path for the frontend (e.g., "2026/05/07/123123-file.pdf")
      const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');

      const metadata = {
        originalName: file.originalname,
        savedAs: relativePath,
        mimetype: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
        ...fileStats
      };

      // Save metadata to a JSON file so we don't lose it on refresh!
      await fs.promises.writeFile(compressedPath + '.json', JSON.stringify(metadata, null, 2));

      // We don't need the original uncompressed file anymore, so we delete it to save space!
      await fs.promises.unlink(file.path).catch(() => { });

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
// We use a wildcard (*) because the path now includes folders (e.g. 2026/05/07/filename)
router.get('/download/*', async (req, res) => {
  const fileRoute = (req.params as any)[0];
  const originalName = req.query.originalName as string;

  // Basic security check to prevent directory traversal
  if (fileRoute.includes('..')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(uploadDir, fileRoute);

  try {
    await fs.promises.access(filePath);
    // Express provides a handy res.download helper, but under the hood, 
    // it uses streams (fs.createReadStream) to send the file to the client!

    // If the client provided the originalName query parameter, we construct the download name
    const downloadName = originalName ? originalName + '.gz' : fileRoute;

    res.download(filePath, downloadName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).send('Error downloading file');
        }
      }
    });
  } catch {
    res.status(404).send('File not found');
  }
});

// GET endpoint to fetch all previously uploaded files
router.get('/files', async (req, res) => {
  try {
    const metadataFiles = await getAllJsonFiles(uploadDir);

    const results = await Promise.all(metadataFiles.map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }));

    // Send the array of past files
    res.json(results);
  } catch (error) {
    console.error("Error fetching past files:", error);
    res.status(500).json({ error: 'Failed to load past files' });
  }
});

export { router as uploadRouter };
