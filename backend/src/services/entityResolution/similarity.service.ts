/**
 * Similarity Service
 * Provides string matching and similarity utilities (Levenshtein, Jaro-Winkler, Token Jaccard, Token-set).
 * Used for deterministic entity resolution scoring.
 */

export class SimilarityService {
  /**
   * Calculate Levenshtein Distance between two strings
   */
  static levenshteinDistance(a: string, b: string): number {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();

    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1 // deletion
            )
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Normalized Levenshtein similarity score between 0.0 and 1.0
   */
  static levenshteinSimilarity(a: string, b: string): number {
    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();
    const maxLength = Math.max(s1.length, s2.length);
    if (maxLength === 0) return 1.0;
    const distance = this.levenshteinDistance(s1, s2);
    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * Jaro-Winkler Distance / Similarity (0.0 to 1.0)
   */
  static jaroWinklerSimilarity(s1: string, s2: string): number {
    let str1 = s1.toLowerCase().trim();
    let str2 = s2.toLowerCase().trim();

    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    let matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    if (matchWindow < 0) matchWindow = 0;

    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < str1.length; i++) {
      let start = Math.max(0, i - matchWindow);
      let end = Math.min(i + matchWindow + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (str2Matches[j]) continue;
        if (str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    const jaro =
      (matches / str1.length +
        matches / str2.length +
        (matches - transpositions / 2) / matches) /
      3.0;

    // Winkler prefix bonus
    let prefix = 0;
    const maxPrefix = 4;
    for (let i = 0; i < Math.min(maxPrefix, str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  /**
   * Tokenize string into normalized words
   */
  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  /**
   * Token Jaccard similarity (0.0 to 1.0)
   */
  static tokenJaccardSimilarity(a: string, b: string): number {
    const tokensA = new Set(this.tokenize(a));
    const tokensB = new Set(this.tokenize(b));

    if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const union = new Set([...tokensA, ...tokensB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Token Set Similarity with synonym/abbreviation awareness (e.g. Pvt / Private, Ltd / Limited)
   */
  static tokenSetSimilarity(a: string, b: string): number {
    const normalizeOrgTokens = (text: string) => {
      return text
        .toLowerCase()
        .replace(/\bpvt\b/g, 'private')
        .replace(/\bltd\b/g, 'limited')
        .replace(/\binc\b/g, 'incorporated')
        .replace(/\bcorp\b/g, 'corporation')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 0);
    };

    const tokensA = new Set(normalizeOrgTokens(a));
    const tokensB = new Set(normalizeOrgTokens(b));

    if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }

    const minSize = Math.min(tokensA.size, tokensB.size);
    return minSize === 0 ? 0 : intersection / minSize;
  }
}
