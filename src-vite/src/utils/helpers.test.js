import { describe, it, expect } from 'vitest';
import {
  generateId,
  shuffleArray,
  formatDate,
  estimateReadingTime,
  calculateRequiredSteps,
  splitContentForSteps,
  sanitizeText,
} from './helpers';

describe('helpers', () => {
  describe('generateId', () => {
    it('should generate a string with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test-/);
    });

    it('should generate unique ids', () => {
      const id1 = generateId('test');
      const id2 = generateId('test');
      expect(id1).not.toBe(id2);
    });
  });

  describe('shuffleArray', () => {
    it('should return an array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(arr);
      expect(shuffled).toHaveLength(arr.length);
    });

    it('should contain same elements', () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    it('should not modify original array', () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      shuffleArray(arr);
      expect(arr).toEqual(original);
    });
  });

  describe('formatDate', () => {
    it('should format timestamp to date string', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const formatted = formatDate(timestamp);
      expect(formatted).toContain('2024');
    });

    it('should handle Date object', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);
      expect(formatted).toContain('2024');
    });

    it('should return fallback for invalid input', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
    });
  });

  describe('estimateReadingTime', () => {
    it('should return 0 for empty text', () => {
      expect(estimateReadingTime('')).toBe(0);
      expect(estimateReadingTime(null)).toBe(0);
    });

    it('should estimate reading time based on character count', () => {
      const text = 'a'.repeat(1000);
      const time = estimateReadingTime(text);
      expect(time).toBeGreaterThanOrEqual(1);
    });

    it('should return minimum 1 for non-empty text', () => {
      const shortText = 'a'.repeat(100);
      const longText = 'a'.repeat(5000);
      expect(estimateReadingTime(shortText)).toBeGreaterThanOrEqual(1);
      expect(estimateReadingTime(longText)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateRequiredSteps', () => {
    it('should return 1 for short content', () => {
      const shortText = 'a'.repeat(100);
      expect(calculateRequiredSteps(shortText)).toBe(1);
    });

    it('should return at least 1 for any content', () => {
      const longText = 'a'.repeat(50000);
      expect(calculateRequiredSteps(longText)).toBeGreaterThanOrEqual(1);
    });

    it('should cap at maximum steps', () => {
      const veryLongText = 'a'.repeat(500000);
      const steps = calculateRequiredSteps(veryLongText);
      expect(steps).toBeLessThanOrEqual(10);
    });
  });

  describe('splitContentForSteps', () => {
    it('should return array of specified length', () => {
      const text = 'This is a test. Another sentence. And one more.';
      const parts = splitContentForSteps(text, 3);
      expect(parts).toHaveLength(3);
    });

    it('should handle single step', () => {
      const text = 'Short text';
      const parts = splitContentForSteps(text, 1);
      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe(text);
    });

    it('should preserve content', () => {
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6';
      const parts = splitContentForSteps(text, 2);
      const joined = parts.join(' ');
      // Check all words are present
      expect(joined).toContain('Word1');
      expect(joined).toContain('Word6');
    });
  });

  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const html = '<script>alert("xss")</script>Hello';
      const clean = sanitizeText(html);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('Hello');
    });

    it('should preserve whitespace', () => {
      const text = '  Hello World  ';
      const clean = sanitizeText(text);
      expect(clean).toBe('  Hello World  ');
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should return null for null input', () => {
      expect(sanitizeText(null)).toBeNull();
    });
  });
});
