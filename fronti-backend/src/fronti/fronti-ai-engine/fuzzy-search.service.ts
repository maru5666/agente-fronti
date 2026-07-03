import { Injectable } from '@nestjs/common';

@Injectable()
export class FuzzySearchService {
  similarity(a: string, b: string) {
    if (!a || !b) return 0;
    if (b.includes(a) || a.includes(b)) return 1;
    const distance = this.levenshtein(a, b);
    const max = Math.max(a.length, b.length, 1);
    return Math.max(0, 1 - distance / max);
  }

  tokenOverlap(a: string, b: string) {
    const left = new Set(a.split(' ').filter(Boolean));
    const right = new Set(b.split(' ').filter(Boolean));
    if (!left.size || !right.size) return 0;
    let matches = 0;
    for (const token of left) {
      if (right.has(token) || [...right].some((candidate) => this.similarity(token, candidate) >= 0.82)) matches++;
    }
    return matches / left.size;
  }

  private levenshtein(a: string, b: string) {
    const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return matrix[a.length][b.length];
  }
}
