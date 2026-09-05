import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/errors';

export interface StorageSaveResult {
  fileName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  hash: string;
}

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.txt', '.doc', '.docx', '.csv', '.json',
  '.jpg', '.jpeg', '.png', '.gif', '.mp3', '.mp4', '.wav'
]);

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export class StorageService {
  private static baseDir = path.join(process.cwd(), 'storage', 'evidence');

  /**
   * Ensure base storage directory exists
   */
  private static ensureDir(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Validate file parameters against path traversal and file restrictions
   */
  public static validateFile(originalName: string, buffer: Buffer, mimeType?: string) {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw AppError.badRequest(`File size exceeds maximum allowed limit of 50MB`);
    }

    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw AppError.badRequest(`Unsupported file extension '${ext}'. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
    }

    // Sanitize filename against path traversal
    const sanitizedName = path.basename(originalName).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return { sanitizedName, ext };
  }

  /**
   * Compute SHA-256 hash of a file buffer
   */
  public static computeHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Save an uploaded file buffer to local storage under storage/evidence/<caseId>/<evidenceId>/
   */
  public static saveFile(caseId: string, evidenceId: string, originalName: string, buffer: Buffer, mimeType: string): StorageSaveResult {
    const { sanitizedName } = this.validateFile(originalName, buffer, mimeType);
    const targetDir = path.join(this.baseDir, caseId, evidenceId);
    this.ensureDir(targetDir);

    const targetFilePath = path.join(targetDir, sanitizedName);
    fs.writeFileSync(targetFilePath, buffer);

    const hash = this.computeHash(buffer);
    const relativeStoragePath = path.relative(process.cwd(), targetFilePath);

    return {
      fileName: sanitizedName,
      storagePath: relativeStoragePath,
      mimeType,
      sizeBytes: buffer.length,
      hash,
    };
  }

  /**
   * Get read stream or buffer for a stored file
   */
  public static getFile(storagePath: string): { stream: fs.ReadStream; size: number } {
    const absolutePath = path.resolve(process.cwd(), storagePath);
    
    // Ensure file path is strictly within storage directory (prevent path traversal)
    if (!absolutePath.startsWith(path.resolve(process.cwd(), 'storage'))) {
      throw AppError.forbidden('Invalid storage path access');
    }

    if (!fs.existsSync(absolutePath)) {
      throw AppError.notFound('Evidence file not found in storage');
    }

    const stat = fs.statSync(absolutePath);
    const stream = fs.createReadStream(absolutePath);
    return { stream, size: stat.size };
  }

  /**
   * Check if file exists
   */
  public static fileExists(storagePath: string): boolean {
    const absolutePath = path.resolve(process.cwd(), storagePath);
    return absolutePath.startsWith(path.resolve(process.cwd(), 'storage')) && fs.existsSync(absolutePath);
  }

  /**
   * Delete stored file
   */
  public static deleteFile(storagePath: string): boolean {
    const absolutePath = path.resolve(process.cwd(), storagePath);
    if (this.fileExists(storagePath)) {
      fs.unlinkSync(absolutePath);
      return true;
    }
    return false;
  }

  /**
   * Verify integrity of a stored file against an expected hash
   */
  public static async verifyFileIntegrity(storagePath: string, expectedHash: string | null): Promise<boolean> {
    if (!expectedHash || !this.fileExists(storagePath)) {
      return false;
    }
    const absolutePath = path.resolve(process.cwd(), storagePath);
    const buffer = fs.readFileSync(absolutePath);
    const actualHash = this.computeHash(buffer);
    return actualHash === expectedHash;
  }

  /**
   * Get file read stream
   */
  public static getFileStream(storagePath: string): fs.ReadStream {
    return this.getFile(storagePath).stream;
  }

  /**
   * Read file content as Buffer
   */
  public static getFileBuffer(storagePath: string): Buffer {
    const absolutePath = path.resolve(process.cwd(), storagePath);
    if (!this.fileExists(storagePath)) {
      throw AppError.notFound('Evidence file not found in storage');
    }
    return fs.readFileSync(absolutePath);
  }
}
