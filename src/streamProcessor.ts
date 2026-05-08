import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import { Transform } from 'stream';

export interface FileStats {
  md5Hash: string;
  lineCount: number;
  compressedSize: number;
  compressedPath: string;
}

class LineCounterTransform extends Transform {
  private lineCount = 0;

  constructor() {
    super();
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {

    const text = chunk.toString('utf8');

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') {
        this.lineCount++;
      }
    }

    callback(null, chunk);
  }

  getLineCount() {
    return this.lineCount;
  }
}

export function processFileStream(filePath: string, compressedFilePath: string): Promise<FileStats> {
  return new Promise((resolve, reject) => {

    const readStream = fs.createReadStream(filePath);

    const hashStream = crypto.createHash('md5');
    const lineCounter = new LineCounterTransform();
    const gzipStream = zlib.createGzip();

    const writeStream = fs.createWriteStream(compressedFilePath);

    readStream.pipe(hashStream);

    readStream
      .pipe(lineCounter)
      .pipe(gzipStream)
      .pipe(writeStream)
      .on('finish', () => {

        const md5Hash = hashStream.digest('hex');

        const totalLines = lineCounter.getLineCount() + 1;

        const compressedSize = fs.statSync(compressedFilePath).size;

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