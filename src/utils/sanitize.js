/**
 * Strips HTML tags and script content from user-submitted text.
 * Call this before saving any user-generated content to storage.
 *
 * React's JSX expression rendering ({text}) already escapes output,
 * so this utility removes the dangerous markup rather than encoding it.
 * This keeps text readable while neutralizing injected HTML/scripts.
 */

/** Max safe length for free-text fields (prevents storage abuse) */
export const MAX_TEXT_LENGTH = 5000;
export const MAX_SHORT_TEXT_LENGTH = 1000;
export const MAX_TITLE_LENGTH = 200;

/**
 * Strip HTML tags and script blocks from a string, then trim and truncate.
 * Returns an empty string for non-string input.
 *
 * @param {*} text - user-supplied input
 * @param {number} [maxLength=MAX_TEXT_LENGTH] - optional truncation limit
 * @returns {string} sanitized plain text
 */
export function sanitizeUserInput(text, maxLength = MAX_TEXT_LENGTH) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLength);
}
