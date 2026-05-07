import express from 'express';
import path from 'path';
import { uploadRouter } from './uploadHandler';

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Use the upload router for /api
app.use('/api', uploadRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
