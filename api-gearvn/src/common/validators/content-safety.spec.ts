import { BadRequestException } from '@nestjs/common';

import { sanitizePlainTextContent } from './content-safety';

describe('sanitizePlainTextContent', () => {
  it('trims valid plain text', () => {
    expect(sanitizePlainTextContent('  Noi dung binh luan hop le  ')).toBe(
      'Noi dung binh luan hop le',
    );
  });

  it('rejects empty content', () => {
    expect(() => sanitizePlainTextContent('   ')).toThrow(BadRequestException);
  });

  it.each(['<script>alert(1)</script>', 'javascript:alert(1)', '<img onerror=alert(1)>'])(
    'rejects unsafe payload %s',
    (payload) => {
      expect(() => sanitizePlainTextContent(payload)).toThrow(
        BadRequestException,
      );
    },
  );
});
