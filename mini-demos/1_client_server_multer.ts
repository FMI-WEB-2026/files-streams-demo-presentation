import express from 'express';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'temp/' });

app.post('/upload', upload.single('document'), (req, res) => {
  console.log("=== ПРИСТИГНА МУЛТИПАРТ ЗАЯВКА ===");

  if (req.file) {
    console.log("📦 Разопаковани Метаданни от Multer:");
    console.log("1. Оригинално име:", req.file.originalname);
    console.log("2. Размер (Bytes):", req.file.size);
    console.log("3. Mimetype (Тип):", req.file.mimetype);
    console.log("4. Временен път:", req.file.path);
  }

  res.send("Файлът е получен и разопакован успешно!");
});

app.listen(3001, () => {
  console.log('Сървърът слуша на порт 3001');
});
