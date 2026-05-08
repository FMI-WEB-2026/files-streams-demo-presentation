import fs from 'fs';
import { Transform, pipeline } from 'stream';

class UppercaseTransform extends Transform {
  _transform(chunk: Buffer, encoding: string, callback: Function) {
    const uppercased = chunk.toString('utf-8').toUpperCase();
    callback(null, uppercased);
  }
}

function pipelineDemo() {
  console.log("=== ДЕМО: PIPELINE & TRANSFORM ===");
  console.log("Четем файл, трансформираме го В ДВИЖЕНИЕ и го записваме в нов файл...\n");

  if (!fs.existsSync('tiny.txt')) {
    fs.writeFileSync('tiny.txt', 'this text is going to be completely uppercase soon!');
  }

  const inputStream = fs.createReadStream('tiny.txt');

  const upperStream = new UppercaseTransform();

  const outputStream = fs.createWriteStream('tiny_UPPERCASE.txt');

  pipeline(
    inputStream,
    upperStream,
    outputStream,
    (err) => {
      if (err) {
        console.error("❌ Пайплайнът се провали:", err);
      } else {
        console.log("✅ Пайплайнът завърши успешно!");
        console.log("Отворете файла 'tiny_UPPERCASE.txt', за да видите резултата!");
      }
    }
  );
}

pipelineDemo();
