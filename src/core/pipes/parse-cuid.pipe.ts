import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

// Accepts both cuid v1 (c + 24 alphanum) and cuid2 (letter + 23 alphanum, no prefix constraint).
// The pattern is intentionally loose — real security comes from DB lookups returning null.
// Rejects obviously malformed strings (empty, too short/long, invalid chars, SQL-injection attempts).
const CUID_RE = /^[a-z][a-z0-9]{6,63}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID_RE.test(value)) {
      throw new BadRequestException(
        `Validation failed (invalid CUID): ${value}`,
      );
    }
    return value;
  }
}
