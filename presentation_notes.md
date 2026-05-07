# Web Development Presentation Notes: File Uploads & Streams

## 1. Uploading a File and Returning Basic Info
In our demo project, we use **Multer** (a Node.js middleware for handling `multipart/form-data`) to intercept the uploaded file from the client.
Once the file is uploaded and saved to the disk, the server responds with a JSON object containing information like `originalName`, `savedAs`, `sizeBytes`, `mimetype`, and further details we calculate manually (like `md5Hash` and `lineCount`).

## 2. Where are Uploaded Files Stored?
- **Small to Medium Apps:** Usually stored directly on the server's filesystem in a dedicated directory (e.g., `/uploads`).
- **Large-Scale Apps:** Stored in cloud object storage like **Amazon S3**, **Google Cloud Storage**, or **Azure Blob Storage** for better scalability, redundancy, and CDN integration.

### How Should We Organize Them?
Never save a file with its original name provided by the user, as this can lead to naming collisions (overwriting files) and security vulnerabilities.
Common organization strategies:
1. **Timestamping & Randomization:** Prepend the current timestamp and a random string to the original filename (e.g., `1684321901-8392-document.pdf`).
2. **Hashing:** Calculate the file's hash (e.g., SHA-256) and use it as the filename. This guarantees uniqueness and automatically prevents saving duplicate files.
3. **Directory Partitioning:** For millions of files, split them into subdirectories based on date or hash prefixes (e.g., `/uploads/2026/05/` or `/uploads/ab/cd/abcdef1234...`).

## 3. Working with Files in JS/TS
Node.js provides the `fs` (File System) module to interact with files. 
You can use functions like `fs.readFile()` (reads the entire file into RAM at once) or `fs.createReadStream()` (reads the file chunk by chunk).

## 4. Streams in JS/TS
Streams are collections of data — just like arrays or strings. The difference is that streams might not be available all at once, and they don't have to fit in memory. This makes streams extremely powerful when working with large amounts of data, or data that's coming from an external source one *chunk* at a time.

### Types of Streams
Node.js has four fundamental stream types:
1. **Readable:** Streams from which data can be read (e.g., `fs.createReadStream()`).
2. **Writable:** Streams to which data can be written (e.g., `fs.createWriteStream()`).
3. **Duplex:** Streams that are both Readable and Writable (e.g., a TCP network socket).
4. **Transform:** A type of Duplex stream where the output is computed in some way from the input (e.g., `crypto.createHash()`, or zipping a file using `zlib`).

### How Streams Work
Streams operate on **chunks** of data. Instead of loading a 1GB file into RAM, a stream loads a small chunk (e.g., 64KB), processes it, and then discards it from memory to load the next chunk. This keeps the memory footprint very low and constant, regardless of the file size.

## 5. Serial Processing & Pipes
- **Serial Processing:** This refers to taking a chunk of data, applying a series of operations to it sequentially, and then moving to the next chunk.
- **Pipes (`.pipe()`):** The `pipe` method is the mechanism used to connect streams together. It attaches a Readable stream to a Writable/Transform stream, automatically managing the flow of data so that the fast readable stream doesn't overwhelm the slow writable stream (this is called handling *backpressure*).

**Example from our demo:**
We demonstrate an advanced concept called **Stream Forking**, where one Readable stream is piped to multiple destinations:
```typescript
// Fork A: Calculate MD5 Hash
readStream.pipe(hashStream);

// Fork B: Count lines -> Compress -> Write to Disk
readStream                // Readable stream (reads file from disk)
  .pipe(lineCounter)      // Transform stream (counts lines)
  .pipe(gzipStream)       // Transform stream (compresses using Zlib)
  .pipe(writeStream)      // Writable stream (saves compressed file to disk)
```
Data flows like water through these pipes. Every chunk of the file is pushed to both forks simultaneously. In Fork B, it goes through the `lineCounter`, gets compressed by `gzipStream`, and is finally written to disk by the `writeStream`. This effectively turns our app into a File Compressor!
