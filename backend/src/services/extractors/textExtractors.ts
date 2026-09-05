import { ProcessingStatus } from '@prisma/client';

export interface ExtractionResult {
  text: string;
  pageCount: number;
  wordCount: number;
  characterCount: number;
  status: ProcessingStatus;
  extractionMethod: string;
  error?: string;
}

export interface ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean;
  extract(buffer: Buffer, fileName: string, mimeType: string): Promise<ExtractionResult>;
}

export class TxtExtractor implements ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean {
    return (
      mimeType.includes('text/plain') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.log')
    );
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return {
      text,
      pageCount: 1,
      wordCount: words.length,
      characterCount: text.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'TXT_PARSER',
    };
  }
}

export class CsvExtractor implements ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean {
    return (
      mimeType.includes('csv') ||
      fileName.endsWith('.csv')
    );
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const raw = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
      return {
        text: '',
        pageCount: 1,
        wordCount: 0,
        characterCount: 0,
        status: ProcessingStatus.COMPLETED,
        extractionMethod: 'CSV_PARSER',
      };
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const formattedRows: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const rowParts: string[] = [];
      headers.forEach((header, idx) => {
        const val = values[idx] || '';
        if (val) {
          rowParts.push(`${header}: ${val}`);
        }
      });
      formattedRows.push(`[Row ${i}] ${rowParts.join(' | ')}`);
    }

    const formattedText = `CSV Headers: ${headers.join(', ')}\n` + formattedRows.join('\n');
    const words = formattedText.split(/\s+/).filter((w) => w.length > 0);

    return {
      text: formattedText,
      pageCount: 1,
      wordCount: words.length,
      characterCount: formattedText.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'CSV_PARSER',
    };
  }
}

export class JsonExtractor implements ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean {
    return (
      mimeType.includes('json') ||
      fileName.endsWith('.json')
    );
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const raw = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();
    let text = raw;

    try {
      const parsed = JSON.parse(raw);
      text = JSON.stringify(parsed, null, 2);
    } catch {
      // Keep raw string if JSON parsing fails
    }

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return {
      text,
      pageCount: 1,
      wordCount: words.length,
      characterCount: text.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'JSON_PARSER',
    };
  }
}

export class DocxExtractor implements ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean {
    return (
      mimeType.includes('wordprocessingml') ||
      fileName.endsWith('.docx')
    );
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const textContent = buffer.toString('utf-8');
    // Extract XML text tags <w:t>...</w:t> from docx binary/xml buffer cleanly
    const regex = /<w:t[^>]*>(.*?)<\/w:t>/g;
    const paragraphs: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(textContent)) !== null) {
      if (match[1]) {
        paragraphs.push(match[1]);
      }
    }

    let text = paragraphs.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      // Fallback: strip binary characters
      text = textContent.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return {
      text,
      pageCount: 1,
      wordCount: words.length,
      characterCount: text.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'DOCX_PARSER',
    };
  }
}

export class PdfExtractor implements ITextExtractor {
  canHandle(mimeType: string, fileName: string): boolean {
    return (
      mimeType.includes('pdf') ||
      fileName.endsWith('.pdf')
    );
  }

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const pdfString = buffer.toString('binary');
    const textPieces: string[] = [];
    
    // Extract text streams: BT ... ET blocks or (text) Tj/TJ strings
    const btRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;
    let pages = 0;
    
    const pageMatches = pdfString.match(/\/Type\s*\/Page\b/g);
    pages = pageMatches ? pageMatches.length : 1;

    while ((match = btRegex.exec(pdfString)) !== null) {
      const block = match[1];
      const stringMatches = block.match(/\((.*?)\)\s*(?:Tj|TJ|'|")/g);
      if (stringMatches) {
        for (const strMatch of stringMatches) {
          const cleaned = strMatch.replace(/^\(/, '').replace(/\)\s*(?:Tj|TJ|'|")$/, '').trim();
          if (cleaned) textPieces.push(cleaned);
        }
      }
    }

    const text = textPieces.join(' ').replace(/\s+/g, ' ').trim();

    if (!text || text.length === 0) {
      return {
        text: '',
        pageCount: pages,
        wordCount: 0,
        characterCount: 0,
        status: ProcessingStatus.OCR_REQUIRED,
        extractionMethod: 'PDF_PARSER',
        error: 'No text stream found in PDF. Document appears to be a scanned image requiring OCR.',
      };
    }

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    return {
      text,
      pageCount: pages,
      wordCount: words.length,
      characterCount: text.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'PDF_PARSER',
    };
  }
}

export class DocumentExtractorFactory {
  private static extractors: ITextExtractor[] = [
    new TxtExtractor(),
    new CsvExtractor(),
    new JsonExtractor(),
    new DocxExtractor(),
    new PdfExtractor(),
  ];

  static async extract(buffer: Buffer, fileName: string, mimeType: string): Promise<ExtractionResult> {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(mimeType, fileName)) {
        return extractor.extract(buffer, fileName, mimeType);
      }
    }

    // Default fallback extractor
    const rawText = buffer.toString('utf-8').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    if (!rawText) {
      return {
        text: '',
        pageCount: 1,
        wordCount: 0,
        characterCount: 0,
        status: ProcessingStatus.UNSUPPORTED,
        extractionMethod: 'UNSUPPORTED_FORMAT',
        error: `Unsupported file format for '${fileName}' (${mimeType})`,
      };
    }

    const words = rawText.split(/\s+/).filter((w) => w.length > 0);
    return {
      text: rawText,
      pageCount: 1,
      wordCount: words.length,
      characterCount: rawText.length,
      status: ProcessingStatus.COMPLETED,
      extractionMethod: 'GENERIC_TEXT_PARSER',
    };
  }
}
