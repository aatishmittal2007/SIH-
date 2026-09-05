import { EntityType } from '@prisma/client';

export class TextNormalizationService {
  /**
   * Normalizes document text cleanly while preserving original punctuation and critical identifiers
   */
  static normalizeDocumentText(text: string): string {
    if (!text) return '';
    return text
      .normalize('NFC')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Normalizes entity values according to entity type rules for exact deduplication matching
   */
  static normalizeEntityValue(value: string, type: EntityType): string {
    if (!value) return '';
    let val = value.trim();

    switch (type) {
      case EntityType.EMAIL:
        return val.toLowerCase();

      case EntityType.DOMAIN:
      case EntityType.URL:
        return val
          .toLowerCase()
          .replace(/^https?:\/\//i, '')
          .replace(/\/.*$/, '')
          .replace(/^www\./i, '');

      case EntityType.PHONE:
        // Keep + if leading, strip spaces, dashes, parentheses
        const leadingPlus = val.startsWith('+') ? '+' : '';
        const digits = val.replace(/\D/g, '');
        return leadingPlus + digits;

      case EntityType.USERNAME:
        return val.replace(/^@/, '').toLowerCase();

      case EntityType.IP_ADDRESS:
        return val.toLowerCase();

      case EntityType.ACCOUNT:
      case EntityType.TRANSACTION:
      case EntityType.DEVICE:
        return val.toUpperCase().replace(/\s+/g, '');

      case EntityType.PERSON:
      case EntityType.ORGANIZATION:
      case EntityType.LOCATION:
      default:
        return val.toLowerCase().replace(/\s+/g, ' ');
    }
  }
}
