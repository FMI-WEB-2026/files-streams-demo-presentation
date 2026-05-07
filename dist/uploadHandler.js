"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const streamProcessor_1 = require("./streamProcessor");
const router = (0, express_1.Router)();
exports.uploadRouter = router;
// --- 1. Where are files stored? ---
// Standard practice is to store them on a disk in a dedicated directory.
// For large-scale apps, you would upload them to cloud storage like AWS S3.
// Here, we store them locally in the 'uploads' folder.
const uploadDir = path_1.default.join(__dirname, '../uploads');
// Ensure uploads directory exists
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// --- 2. File Organization ---
// Multer Disk Storage configures how files are saved.
// It's crucial to rename files to avoid overwriting and security risks.
const storage = multer_1.default.diskStorage({
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
const upload = (0, multer_1.default)({ storage });
// POST endpoint to handle single file upload
// 'document' is the name of the field in our HTML form
router.post('/upload', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        // After Multer saves the file to disk, we can use streams to process it.
        // This demonstrates working with files and streams in JS/TS.
        const compressedPath = req.file.path + '.gz';
        const fileStats = await (0, streamProcessor_1.processFileStream)(req.file.path, compressedPath);
        // Returning basic information to the client
        res.json({
            message: 'File uploaded, processed, and compressed successfully!',
            originalName: req.file.originalname,
            savedAs: req.file.filename,
            mimetype: req.file.mimetype,
            sizeBytes: req.file.size,
            storagePath: req.file.path,
            ...fileStats
        });
    }
    catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: 'Error processing file stream' });
    }
});
// GET endpoint to download the compressed file
router.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    // Basic security check to prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).send('Invalid filename');
    }
    const filePath = path_1.default.join(uploadDir, filename);
    if (fs_1.default.existsSync(filePath)) {
        // Express provides a handy res.download helper, but under the hood, 
        // it uses streams (fs.createReadStream) to send the file to the client!
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error downloading file:", err);
                if (!res.headersSent) {
                    res.status(500).send('Error downloading file');
                }
            }
        });
    }
    else {
        res.status(404).send('File not found');
    }
});
