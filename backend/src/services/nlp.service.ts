import { EntityType, ExtractionMethod } from '@prisma/client';
import { TextNormalizationService } from './textNormalization.service';

export interface ExtractedEntityResult {
  text: string;
  type: EntityType;
  normalizedValue: string;
  confidence: number;
  startOffset: number;
  endOffset: number;
  context: string;
  extractionMethod: ExtractionMethod;
  metadata?: Record<string, any>;
}

export interface INlpProvider {
  extractEntities(text: string): Promise<ExtractedEntityResult[]>;
}

export class NlpService implements INlpProvider {
  private static aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  /**
   * Instance method satisfying INlpProvider interface
   */
  async extractEntities(text: string): Promise<ExtractedEntityResult[]> {
    return NlpService.extractEntities(text);
  }

  /**
   * Helper method for document text preprocessing and basic metrics calculation
   */
  static preprocessDocument(buffer: Buffer, mimeType: string, fileName: string) {
    const rawText = buffer.toString('utf-8').replace(/\r\n/g, '\n');
    const lines = rawText.trim().split('\n');
    const wordCount = rawText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      fileName,
      mimeType,
      lineCount: lines.length,
      wordCount,
      characterCount: rawText.length,
      rawText,
    };
  }

  /**
   * Primary NLP entity extraction entry point with AI service integration & deterministic fallback
   */
  static async extractEntities(text: string): Promise<ExtractedEntityResult[]> {
    if (!text || !text.trim()) {
      return [];
    }

    // 1. High-confidence deterministic regex extractions
    const deterministicEntities = this.extractDeterministicEntities(text);

    // 2. Attempt AI service call
    let aiEntities: ExtractedEntityResult[] = [];
    try {
      const response = await fetch(`${this.aiServiceUrl}/extract-entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (response.ok) {
        const data: any = await response.json();
        if (data && Array.isArray(data.entities)) {
          aiEntities = data.entities
            .map((item: any) => {
              const rawText = (item.text || '').trim();
              if (!rawText) return null;

              const type = this.mapToPrismaEntityType(item.type, item.metadata);
              const confidence = Math.max(0, Math.min(1.0, item.confidence ?? 0.85));
              const startOffset = Math.max(0, item.start_offset ?? text.indexOf(rawText));
              const endOffset = item.end_offset ?? startOffset + rawText.length;
              const normalizedValue = TextNormalizationService.normalizeEntityValue(rawText, type);

              return {
                text: rawText,
                type,
                normalizedValue,
                confidence,
                startOffset,
                endOffset,
                context: item.context || this.extractContextSnippet(text, startOffset, endOffset),
                extractionMethod: (item.extraction_method || ExtractionMethod.NER) as ExtractionMethod,
                metadata: item.metadata || {},
              };
            })
            .filter((item: ExtractedEntityResult | null): item is ExtractedEntityResult => item !== null);
        }
      }
    } catch (err: any) {
      console.warn(`[NLP SERVICE WARNING] AI Service call failed (${err.message}). Falling back to rule engine.`);
    }

    // 3. Fallback regex NER if AI service returned nothing or failed
    const fallbackEntities = aiEntities.length > 0 ? [] : this.fallbackExtractEntities(text);

    // 4. Merge and deduplicate by span & type
    const mergedMap = new Map<string, ExtractedEntityResult>();

    const addEntity = (item: ExtractedEntityResult) => {
      const key = `${item.startOffset}-${item.endOffset}-${item.type}-${item.normalizedValue}`;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, item);
      }
    };

    deterministicEntities.forEach(addEntity);
    aiEntities.forEach(addEntity);
    fallbackEntities.forEach(addEntity);

    return Array.from(mergedMap.values()).sort((a, b) => a.startOffset - b.startOffset);
  }

  /**
   * Deterministic extractions for high-confidence pattern matches (EMAIL, PHONE, IP, URL, DOMAIN, ACCOUNT, DEVICE)
   */
  private static extractDeterministicEntities(text: string): ExtractedEntityResult[] {
    const results: ExtractedEntityResult[] = [];
    const seenSpans = new Set<string>();

    const patterns: Array<{ type: EntityType; regex: RegExp; confidence: number; method: ExtractionMethod }> = [
      {
        type: EntityType.EMAIL,
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        confidence: 0.98,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.IP_ADDRESS,
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        confidence: 0.98,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.URL,
        regex: /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+\b/g,
        confidence: 0.95,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.PHONE,
        regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
        confidence: 0.92,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.ACCOUNT,
        regex: /\b(?:ACC-\d{4,8}|TXN-[A-Za-z0-9]{5,12}|0x[a-fA-F0-9]{40})\b/g,
        confidence: 0.95,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.USERNAME,
        regex: /(?<=\s|^)@[A-Za-z0-9_]{3,20}\b/g,
        confidence: 0.90,
        method: ExtractionMethod.RULE,
      },
    ];

    for (const item of patterns) {
      item.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = item.regex.exec(text)) !== null) {
        const matchedText = match[0].trim();
        const start = match.index;
        const end = start + matchedText.length;
        const key = `${start}-${end}-${item.type}`;

        if (!seenSpans.has(key) && matchedText.length > 2) {
          seenSpans.add(key);
          const normalizedValue = TextNormalizationService.normalizeEntityValue(matchedText, item.type);
          results.push({
            text: matchedText,
            type: item.type,
            normalizedValue,
            confidence: item.confidence,
            startOffset: start,
            endOffset: end,
            context: this.extractContextSnippet(text, start, end),
            extractionMethod: item.method,
          });
        }
      }
    }

    return results;
  }

  /**
   * Deterministic Node.js Rule & Regex NER Fallback Engine
   */
  private static fallbackExtractEntities(text: string): ExtractedEntityResult[] {
    const results: ExtractedEntityResult[] = [];
    const seenSpans = new Set<string>();

    const patterns: Array<{ type: EntityType; regex: RegExp; confidence: number; method: ExtractionMethod }> = [
      {
        type: EntityType.DOMAIN,
        regex: /\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|co|in|info)\b/g,
        confidence: 0.90,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.DEVICE,
        regex: /\b[A-Z]{2}[-\s]?\d{2}[-\s]?[A-Z]{1,2}[-\s]?\d{4}\b/g,
        confidence: 0.88,
        method: ExtractionMethod.RULE,
      },
      {
        type: EntityType.PERSON,
        regex: /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Agent|Inspector|Officer|Suspect)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g,
        confidence: 0.82,
        method: ExtractionMethod.NER,
      },
      {
        type: EntityType.ORGANIZATION,
        regex: /\b([A-Z][A-Za-z0-9&\s]+(?:Corp|Corporation|Inc|Limited|Ltd|Group|Bank|Agency|Pvt|LLC|Logistics))\b/g,
        confidence: 0.85,
        method: ExtractionMethod.NER,
      },
      {
        type: EntityType.LOCATION,
        regex: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+Station|\s+Central|\s+Airport|\s+City|\s+Street|\s+Road|\s+Park))\b/g,
        confidence: 0.80,
        method: ExtractionMethod.NER,
      },
    ];

    for (const item of patterns) {
      item.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = item.regex.exec(text)) !== null) {
        const rawMatch = match[0];
        const matchedText = (match[1] || rawMatch).trim();
        const offsetInMatch = rawMatch.indexOf(matchedText);
        const start = match.index + (offsetInMatch >= 0 ? offsetInMatch : 0);
        const end = start + matchedText.length;
        const key = `${start}-${end}-${item.type}`;

        if (!seenSpans.has(key) && matchedText.length > 2) {
          seenSpans.add(key);
          const normalizedValue = TextNormalizationService.normalizeEntityValue(matchedText, item.type);
          results.push({
            text: matchedText,
            type: item.type,
            normalizedValue,
            confidence: item.confidence,
            startOffset: start,
            endOffset: end,
            context: this.extractContextSnippet(text, start, end),
            extractionMethod: item.method,
          });
        }
      }
    }

    return results;
  }

  private static extractContextSnippet(text: string, start: number, end: number): string {
    const snippetStart = Math.max(0, start - 35);
    const snippetEnd = Math.min(text.length, end + 35);
    const context = text.substring(snippetStart, snippetEnd).replace(/\n/g, ' ');
    return (snippetStart > 0 ? '...' : '') + context + (snippetEnd < text.length ? '...' : '');
  }

  private static mapToPrismaEntityType(typeStr: string, metadata?: Record<string, any>): EntityType {
    const upper = (typeStr || '').toUpperCase();
    const patternKey = (metadata?.pattern_key || '').toUpperCase();

    if (patternKey.includes('PHONE') || upper.includes('PHONE')) return EntityType.PHONE;
    if (patternKey.includes('EMAIL') || upper.includes('EMAIL')) return EntityType.EMAIL;

    if (Object.values(EntityType).includes(upper as EntityType)) {
      return upper as EntityType;
    }

    if (upper.includes('IP') || upper.includes('HOST')) return EntityType.IP_ADDRESS;
    if (upper.includes('URL') || upper.includes('LINK')) return EntityType.URL;
    if (upper.includes('DOMAIN') || upper.includes('WEBSITE')) return EntityType.DOMAIN;
    if (upper.includes('USER') || upper.includes('HANDLE')) return EntityType.USERNAME;
    if (upper.includes('CRYPTO') || upper.includes('BANK') || upper.includes('ACCOUNT') || upper.includes('WALLET'))
      return EntityType.ACCOUNT;
    if (upper.includes('VEHICLE') || upper.includes('DEVICE')) return EntityType.DEVICE;
    if (upper.includes('PERSON') || upper.includes('NAME')) return EntityType.PERSON;
    if (upper.includes('ORG') || upper.includes('COMPANY')) return EntityType.ORGANIZATION;
    if (upper.includes('LOCATION') || upper.includes('CITY') || upper.includes('ADDRESS')) return EntityType.LOCATION;
    if (upper.includes('TRANSACTION') || upper.includes('TXN')) return EntityType.TRANSACTION;

    return EntityType.OTHER;
  }
}
