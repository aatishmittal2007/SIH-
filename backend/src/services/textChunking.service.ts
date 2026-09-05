export interface DocumentChunk {
  chunkIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
  pageNumber?: number;
}

export class TextChunkingService {
  /**
   * Split normalized document text into overlapping chunks with character offsets
   */
  static chunkText(
    text: string,
    chunkSize: number = 1000,
    overlap: number = 100
  ): DocumentChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    if (text.length <= chunkSize) {
      return [
        {
          chunkIndex: 0,
          text,
          startOffset: 0,
          endOffset: text.length,
          pageNumber: 1,
        },
      ];
    }

    const chunks: DocumentChunk[] = [];
    let startOffset = 0;
    let chunkIndex = 0;

    while (startOffset < text.length) {
      let endOffset = startOffset + chunkSize;
      if (endOffset > text.length) {
        endOffset = text.length;
      } else {
        // Try to break at nearest whitespace or line break within last 100 chars to avoid splitting words
        const sub = text.substring(startOffset, endOffset);
        const lastSpace = Math.max(sub.lastIndexOf(' '), sub.lastIndexOf('\n'));
        if (lastSpace > chunkSize - 150 && lastSpace > 0) {
          endOffset = startOffset + lastSpace;
        }
      }

      const chunkText = text.substring(startOffset, endOffset);
      chunks.push({
        chunkIndex,
        text: chunkText,
        startOffset,
        endOffset,
        pageNumber: 1,
      });

      chunkIndex++;
      if (endOffset >= text.length) break;

      // Advance by chunkSize minus overlap
      startOffset = endOffset - Math.min(overlap, endOffset - startOffset);
    }

    return chunks;
  }
}
