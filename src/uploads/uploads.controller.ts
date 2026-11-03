import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AdminGuard } from '../auth/admin.guard';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

// SVG is deliberately excluded: served from our origin it could carry script.
const ALLOWED: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
};

@Controller('uploads')
export class UploadsController {
  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 3 * 1024 * 1024 },
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => cb(null, randomBytes(12).toString('hex') + (ALLOWED[file.mimetype] ?? extname(file.originalname))),
    }),
    fileFilter: (_req, file, cb) =>
      ALLOWED[file.mimetype] ? cb(null, true) : cb(new BadRequestException('Only PNG, JPG, WEBP or GIF images are allowed'), false),
  }))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return { url: `/uploads/${file.filename}` };
  }
}
