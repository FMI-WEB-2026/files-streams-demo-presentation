"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const uploadHandler_1 = require("./uploadHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Serve static files from 'public' directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Use the upload router for /api
app.use('/api', uploadHandler_1.uploadRouter);
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
