import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@shared/prisma/prisma.service';
import { StorageService } from '@shared/storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

// MIME types we accept and their canonical extensions
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

// Minimal magic-byte checks (Buffer offset, bytes to match)
const MAGIC_BYTES: Array<{ mime: string; offset: number; bytes: number[] }> = [
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/pdf', offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

function detectMime(buf: Buffer): string | null {
  for (const { mime, offset, bytes } of MAGIC_BYTES) {
    if (bytes.every((b, i) => buf[offset + i] === b)) return mime;
  }
  return null;
}

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Upload ──────────────────────────────────────────────────────────────

  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    tenantId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 20 MB size limit');
    }

    const detectedMime = detectMime(file.buffer);
    if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: JPEG, PNG, PDF',
      );
    }

    // Ensure the verification belongs to this tenant
    const verification = await this.prisma.verification.findUnique({
      where: { id: dto.verificationId },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    if (verification.tenantId !== tenantId) throw new ForbiddenException();

    const ext = ALLOWED_MIME[detectedMime];
    const storagePath = `${tenantId}/${dto.verificationId}/${uuidv4()}.${ext}`;

    await this.storage.uploadFile(file.buffer, storagePath, detectedMime);

    const document = await this.prisma.document.create({
      data: {
        verificationId: dto.verificationId,
        templateId: dto.templateId || null,
        docType: dto.docType,
        filePath: storagePath,
      },
    });

    const presignedUrl = await this.storage.getPresignedUrl(storagePath);

    return { document, presignedUrl };
  }

  // ─── Bulk upload (process files in parallel, collect per-file results) ───

  async uploadBulk(
    files: Express.Multer.File[],
    verificationId: string,
    docTypes: string[],
    tenantId: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be provided');
    }
    // Verify the verification belongs to this tenant once, upfront
    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    if (verification.tenantId !== tenantId) throw new ForbiddenException();

    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const docType = docTypes[i] ?? 'other';

        if (file.size > MAX_SIZE_BYTES) {
          throw new BadRequestException(
            `File "${file.originalname}" exceeds the 20 MB size limit`,
          );
        }

        const detectedMime = detectMime(file.buffer);
        if (!detectedMime || !ALLOWED_MIME[detectedMime]) {
          throw new BadRequestException(
            `File "${file.originalname}" is not a supported type (JPEG, PNG, PDF)`,
          );
        }

        const ext = ALLOWED_MIME[detectedMime];
        const storagePath = `${tenantId}/${verificationId}/${uuidv4()}.${ext}`;

        await this.storage.uploadFile(file.buffer, storagePath, detectedMime);

        const document = await this.prisma.document.create({
          data: { verificationId, docType, filePath: storagePath },
        });

        const presignedUrl = await this.storage.getPresignedUrl(storagePath);
        return { document, presignedUrl };
      }),
    );

    const succeeded = results
      .map((r, i) => (r.status === 'fulfilled' ? r.value : null))
      .filter(Boolean);

    const failed = results
      .map((r, i) =>
        r.status === 'rejected'
          ? {
              index: i,
              filename: files[i]?.originalname ?? `file[${i}]`,
              error:
                r.reason instanceof Error ? r.reason.message : String(r.reason),
            }
          : null,
      )
      .filter(Boolean);

    return { uploaded: succeeded, errors: failed };
  }

  // ─── List for a verification ──────────────────────────────────────────────

  async findByVerification(verificationId: string, tenantId: string) {
    const verification = await this.prisma.verification.findUnique({
      where: { id: verificationId },
    });
    if (!verification) throw new NotFoundException('Verification not found');
    if (verification.tenantId !== tenantId) throw new ForbiddenException();

    return this.prisma.document.findMany({
      where: { verificationId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  // ─── Fresh presigned URL ──────────────────────────────────────────────────

  async getPresignedUrl(documentId: string, tenantId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { verification: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.verification.tenantId !== tenantId) throw new ForbiddenException();

    const presignedUrl = await this.storage.getPresignedUrl(doc.filePath);
    return { presignedUrl };
  }
}
