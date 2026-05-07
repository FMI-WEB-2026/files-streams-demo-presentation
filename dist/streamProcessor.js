"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileStream = processFileStream;
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const zlib_1 = __importDefault(require("zlib"));
const stream_1 = require("stream");
// --- Types of Streams & How they work ---
// Transform Stream: A type of Duplex stream where the output is computed in some way from the input.
// Here we create a custom Transform stream to count the number of lines.
class LineCounterTransform extends stream_1.Transform {
    lineCount = 0;
    constructor() {
        super();
    }
    // The _transform method processes each chunk of data as it passes through the stream
    _transform(chunk, encoding, callback) {
        // Convert chunk buffer to string
        const text = chunk.toString('utf8');
        // Count newline characters in this chunk
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\n') {
                this.lineCount++;
            }
        }
        // Pass the unmodified chunk down the pipeline
        callback(null, chunk);
    }
    getLineCount() {
        return this.lineCount;
    }
}
function processFileStream(filePath, compressedFilePath) {
    return new Promise((resolve, reject) => {
        // 1. Readable Stream
        // We create a readable stream to stream the file data from disk chunk by chunk, 
        // rather than loading the entire file into RAM at once.
        const readStream = fs_1.default.createReadStream(filePath);
        // 2. Transform Streams
        const hashStream = crypto_1.default.createHash('md5'); // Built-in Transform stream for hashing
        const lineCounter = new LineCounterTransform(); // Our custom Transform stream
        const gzipStream = zlib_1.default.createGzip(); // Built-in Transform stream for compression
        // 3. Writable Stream
        // We create a writable stream to save the compressed data to disk.
        const writeStream = fs_1.default.createWriteStream(compressedFilePath);
        // --- Pipes & Serial Processing ---
        // pipe() attaches a Readable stream to a Writable/Transform stream.
        // We demonstrate "Stream Forking" here: we pipe the same readable stream to multiple destinations!
        // Fork A: Calculate MD5 Hash
        readStream.pipe(hashStream);
        // Fork B: Count lines -> Compress -> Write to Disk
        // The data flows sequentially: ReadStream -> LineCounter -> GzipStream -> WriteStream
        readStream
            .pipe(lineCounter)
            .pipe(gzipStream)
            .pipe(writeStream)
            .on('finish', () => {
            // The 'finish' event fires when all streams in the pipeline are done processing
            // Since writeStream finishes last, it's safe to digest the hash here
            const md5Hash = hashStream.digest('hex');
            // Add 1 to line count assuming the last line doesn't end with a newline character
            const totalLines = lineCounter.getLineCount() + 1;
            // After writing finishes, check the new compressed file size
            const compressedSize = fs_1.default.statSync(compressedFilePath).size;
            resolve({
                md5Hash,
                lineCount: totalLines,
                compressedSize,
                compressedPath: compressedFilePath
            });
        })
            .on('error', (err) => {
            reject(err);
        });
        readStream.on('error', reject);
        hashStream.on('error', reject);
        lineCounter.on('error', reject);
        gzipStream.on('error', reject);
    });
}
