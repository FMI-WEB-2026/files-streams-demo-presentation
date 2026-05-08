import fs from 'fs';

function streamDemo() {
  console.log("=== ДЕМО: СТРИЙМ ===");

  const readStream = fs.createReadStream(__filename, { highWaterMark: 64 });

  let chunkCounter = 0;

  readStream.on('data', (chunk) => {
    chunkCounter++;
    console.log(`📦 Пристигна Chunk #${chunkCounter} | Размер: ${chunk.length} байта`);
  });

  readStream.on('end', () => {
    console.log(`\n✅ Стриймът приключи успешно!`);
    console.log(`Общо обработени парчета (chunks): ${chunkCounter}`);
  });

  readStream.on('error', (err) => {
    console.error("❌ Възникна грешка:", err);
  });
}

streamDemo();
