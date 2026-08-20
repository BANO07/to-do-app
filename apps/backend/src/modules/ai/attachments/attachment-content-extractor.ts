import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_MAX_TEXT_CHARS, IMAGE_MIME_TYPES } from './ai-attachment.constants';

export interface ExtractionResult {
  text: string;
  truncated: boolean;
  isImage: boolean;
  imageBase64?: string;
  imageMimeType?: string;
}

@Injectable()
export class AttachmentContentExtractor {
  private readonly logger = new Logger(AttachmentContentExtractor.name);
  private readonly maxTextChars: number;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<number>('AI_ATTACHMENT_MAX_TEXT_CHARS');
    this.maxTextChars =
      configured && configured > 0 ? configured : DEFAULT_MAX_TEXT_CHARS;
  }

  async extract(
    data: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<ExtractionResult> {
    if (IMAGE_MIME_TYPES.has(mimeType)) {
      return {
        text: '',
        truncated: false,
        isImage: true,
        imageBase64: data.toString('base64'),
        imageMimeType: mimeType,
      };
    }

    let raw: string;
    try {
      raw = await this.extractText(data, mimeType, filename);
    } catch (error) {
      this.logger.warn(
        `Extraction failed for ${filename}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      throw new Error('Unable to read this file.');
    }

    const { text, truncated } = this.truncate(raw);
    return { text, truncated, isImage: false };
  }

  private async extractText(
    data: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
        return data.toString('utf-8');

      case 'text/csv':
        return this.extractCsv(data);

      case 'application/pdf':
        return this.extractPdf(data);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractDocx(data);

      default:
        throw new Error(`Unsupported MIME type: ${mimeType} for ${filename}`);
    }
  }

  private extractCsv(data: Buffer): string {
    const text = data.toString('utf-8');
    // Preserve CSV structure as-is for AI understanding
    return text;
  }

  private async extractPdf(data: Buffer): Promise<string> {
    // Dynamic import to avoid issues when module is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (
      buf: Buffer,
    ) => Promise<{ text: string }>;
    const result = await pdfParse(data);
    return result.text ?? '';
  }

  private async extractDocx(data: Buffer): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value ?? '';
  }

  private truncate(text: string): { text: string; truncated: boolean } {
    const trimmed = text.trim();
    if (trimmed.length <= this.maxTextChars) {
      return { text: trimmed, truncated: false };
    }
    const cut = trimmed.slice(0, this.maxTextChars);
    return {
      text: cut + '\n\n[Content truncated — document exceeds size limit]',
      truncated: true,
    };
  }
}
