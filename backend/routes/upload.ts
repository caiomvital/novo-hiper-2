import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const uploadRouter = Router();

const uploadsBaseDir = path.resolve(process.env.UPLOADS_DIR || './uploads');
const plantsUploadDir = path.join(uploadsBaseDir, 'plants');

// Garantir que diretórios existam
if (!fs.existsSync(plantsUploadDir)) {
  fs.mkdirSync(plantsUploadDir, { recursive: true });
}

// Configuração do multer com validações rígidas
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, plantsUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    const randomName = `plant_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${safeExt}`;
    cb(null, randomName);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Apenas imagens nos formatos JPEG, PNG ou WEBP são permitidas.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite máximo de 5MB
    files: 1,
  },
});

uploadRouter.post('/', (req: Request, res: Response): void => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'A foto excede o tamanho máximo permitido de 5MB.' });
        return;
      }
      res.status(400).json({ error: `Erro no upload: ${err.message}` });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
      return;
    }

    // Caminho relativo seguro e limpo para armazenar no banco
    const publicPath = `/uploads/plants/${req.file.filename}`;
    res.status(201).json({
      success: true,
      filePath: publicPath,
      fileName: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});
