// OJT Master v2.3.0 - Helper Utilities

import DOMPurify from 'dompurify';
import { CONFIG } from '../constants';

/**
 * SecureSession - Secure session storage wrapper
 */
export const SecureSession = {
  EXPIRY_MS: CONFIG.SESSION_EXPIRY_MS,
  ALLOWED_KEYS: ['ojt_sessionMode'],
  ALLOWED_VALUES: {
    ojt_sessionMode: ['admin', 'mentor'],
  },

  set(key, value) {
    if (!this.ALLOWED_KEYS.includes(key)) return false;
    if (this.ALLOWED_VALUES[key] && !this.ALLOWED_VALUES[key].includes(value)) {
      return false;
    }

    const data = {
      value,
      timestamp: Date.now(),
      expiry: Date.now() + this.EXPIRY_MS,
    };

    sessionStorage.setItem(key, JSON.stringify(data));
    return true;
  },

  get(key) {
    if (!this.ALLOWED_KEYS.includes(key)) return null;

    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);

      // Check expiry
      if (data.expiry && Date.now() > data.expiry) {
        this.remove(key);
        return null;
      }

      // Validate value
      if (this.ALLOWED_VALUES[key] && !this.ALLOWED_VALUES[key].includes(data.value)) {
        this.remove(key);
        return null;
      }

      return data.value;
    } catch {
      // Handle legacy plain string format
      if (this.ALLOWED_VALUES[key]?.includes(raw)) {
        // Migrate to new format
        this.set(key, raw);
        return raw;
      }
      this.remove(key);
      return null;
    }
  },

  remove(key) {
    sessionStorage.removeItem(key);
  },

  refresh(key) {
    const value = this.get(key);
    if (value) {
      this.set(key, value);
    }
  },
};

/**
 * Sanitize text to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text;
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * Sanitize HTML content
 * @param {string} html - HTML to sanitize
 * @returns {string} - Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return html;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'pre',
      'code',
      'img',
      'a',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
  });
}

/**
 * Sanitize document data from database
 * @param {Object} doc - Document object
 * @returns {Object} - Sanitized document
 */
export function sanitizeDocData(doc) {
  if (!doc) return doc;

  return {
    ...doc,
    title: sanitizeText(doc.title),
    team: sanitizeText(doc.team),
    sections: Array.isArray(doc.sections)
      ? doc.sections.map((s) => ({
          title: sanitizeText(s.title),
          content: sanitizeHtml(s.content),
        }))
      : [],
    quiz: Array.isArray(doc.quiz)
      ? doc.quiz.map((q) => ({
          question: sanitizeText(q.question),
          options: Array.isArray(q.options) ? q.options.map(sanitizeText) : [],
          correct: typeof q.correct === 'number' ? q.correct : 0,
        }))
      : [],
  };
}

/**
 * Estimate reading time for content
 * @param {string} text - Content text
 * @returns {number} - Estimated minutes
 */
export function estimateReadingTime(text) {
  if (!text) return 0;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / CONFIG.CHARS_PER_MINUTE);
}

/**
 * Calculate required steps for content
 * @param {string} text - Content text
 * @returns {number} - Number of steps needed
 */
export function calculateRequiredSteps(text) {
  const minutes = estimateReadingTime(text);
  return Math.max(1, Math.ceil(minutes / CONFIG.STEP_TIME_LIMIT));
}

/**
 * Split content into steps
 * @param {string} text - Content text
 * @param {number} numSteps - Number of steps to split into
 * @returns {string[]} - Array of content segments
 */
export function splitContentForSteps(text, numSteps) {
  if (numSteps <= 1) return [text];

  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  if (paragraphs.length <= numSteps) {
    // Pad with empty strings if not enough paragraphs
    const result = [...paragraphs];
    while (result.length < numSteps) {
      result.push('');
    }
    return result;
  }

  // Distribute paragraphs evenly
  const chunkSize = Math.ceil(paragraphs.length / numSteps);
  const result = [];

  for (let i = 0; i < numSteps; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, paragraphs.length);
    result.push(paragraphs.slice(start, end).join('\n\n'));
  }

  // Handle overflow - merge extra into last segment
  if (result.length > numSteps) {
    const extra = result.splice(numSteps);
    result[numSteps - 1] += '\n\n' + extra.join('\n\n');
  }

  return result.filter((s) => s.trim());
}

/**
 * CSRF protection for delete operations
 * @param {string} docTitle - Document title for confirmation
 * @returns {boolean} - Whether deletion was confirmed
 */
export function confirmDeleteWithCSRF(docTitle) {
  // First confirmation
  if (!confirm(`"${docTitle}" 문서를 정말로 삭제하시겠습니까?`)) {
    return false;
  }

  // Second confirmation with title input
  const userInput = prompt(`삭제하려면 문서 제목을 정확히 입력하세요:\n"${docTitle}"`);

  if (userInput !== docTitle) {
    return false;
  }

  return true;
}

/**
 * Get view state based on role
 * @param {string} role - User role
 * @param {string|null} tempMode - Temporary mode override
 * @returns {string} - View state
 */
export function getViewStateByRole(role, tempMode = null) {
  const roleViewMap = {
    admin: 'admin_dashboard',
    mentor: 'mentor_dashboard',
    mentee: 'mentee_list',
  };

  // Admin can switch to mentor mode
  if (role === 'admin' && tempMode === 'mentor') {
    return 'mentor_dashboard';
  }

  return roleViewMap[role] || 'role_select';
}

/**
 * Generate unique ID
 * @returns {string} - UUID
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format date for display
 * @param {number|string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Fisher-Yates shuffle
 * @param {Array} array - Array to shuffle
 * @returns {Array} - Shuffled array
 */
export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
