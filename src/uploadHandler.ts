import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processFileStream } from './streamProcessor';

const router = Router();

const uploadDir = path.join(__dirname, '../uploads');

(async () => {
  try {
    await fs.promises.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Error creating upload directory:", err);
  }
})();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {

      const date = new Date();
      const year = date.getFullYear().toString();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      const dynamicDir = path.join(uploadDir, year, month, day);

      await fs.promises.mkdir(dynamicDir, { recursive: true });

      cb(null, dynamicDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB limit
  }
});

async function getAllJsonFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  try {
    await fs.promises.access(dir);
  } catch {
    return fileList;
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

router.post('/upload', (req, res) => {
  upload.array('documents', 10)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large! Maximum allowed size is 50MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(500).json({ error: 'Unknown server error during upload.' });
    }

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    try {

      const results = await Promise.all(files.map(async (file) => {
        console.log(`Processing file: ${file.path}`);
        const compressedPath = file.path + '.gz';
        const fileStats = await processFileStream(file.path, compressedPath);
        console.log(`processFileStream finished for: ${file.path}`);

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

          await fs.promises.unlink(file.path).catch(() => { });
          await fs.promises.unlink(compressedPath).catch(() => { });

          return duplicateMeta;
        }

        const relativePath = path.relative(uploadDir, file.path).replace(/\\/g, '/');

        const metadata = {
          originalName: file.originalname,
          savedAs: relativePath,
          mimetype: file.mimetype,
          sizeBytes: file.size,
          storagePath: file.path,
          ...fileStats
        };

        await fs.promises.writeFile(compressedPath + '.json', JSON.stringify(metadata, null, 2));

        await fs.promises.unlink(file.path).catch(() => { });

        return metadata;
      }));

      res.json({
        message: 'Files uploaded, processed, and compressed successfully!',
        results: results
      });
    } catch (error) {
      console.error("Error processing files:", error);
      res.status(500).json({ error: 'Error processing file streams' });
    }
  }); // End of multer wrapper
});

router.get('/download/*', async (req, res) => {
  const fileRoute = (req.params as any)[0];
  const originalName = req.query.originalName as string;

  if (fileRoute.includes('..')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(uploadDir, fileRoute);

  try {
    await fs.promises.access(filePath);

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

router.get('/files', async (req, res) => {
  try {
    const metadataFiles = await getAllJsonFiles(uploadDir);

    const results = await Promise.all(metadataFiles.map(async (filePath) => {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }));

    res.json(results);
  } catch (error) {
    console.error("Error fetching past files:", error);
    res.status(500).json({ error: 'Failed to load past files' });
  }
});

export { router as uploadRouter };
