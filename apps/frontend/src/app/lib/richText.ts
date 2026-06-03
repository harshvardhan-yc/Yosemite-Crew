import DOMPurify from 'isomorphic-dompurify';

/** Tags allowed in stored rich-text HTML (B/I/U, lists, paragraphs, line breaks). */
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'];
const ALLOWED_ATTR = ['class'];

/** Sanitize editor HTML before storing/sending to the backend. */
export const sanitizeRichText = (html: string): string =>
  DOMPurify.sanitize(html ?? '', { ALLOWED_TAGS, ALLOWED_ATTR });

/** Strip tags to test whether a rich-text value carries any visible content. */
export const isRichTextEmpty = (html: string | undefined): boolean => {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return text.length === 0;
};
