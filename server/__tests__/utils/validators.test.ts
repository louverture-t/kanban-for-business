import { describe, it, expect } from 'vitest';
import { validatePassword, validateUsername, sanitizeInput } from '@server/utils/validators.js';

describe('validatePassword', () => {
  it('rejects password shorter than 8 characters', () => {
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/8 characters/);
  });

  it('rejects password missing uppercase letter', () => {
    const result = validatePassword('abcdefg1!');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/uppercase/);
  });

  it('rejects password missing number', () => {
    const result = validatePassword('Abcdefgh!');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/number/);
  });

  it('rejects password missing special character', () => {
    const result = validatePassword('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/special character/);
  });

  it('accepts valid password', () => {
    const result = validatePassword('MyP@ssw0rd');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });
});

describe('validateUsername', () => {
  it('rejects username shorter than 3 characters', () => {
    const result = validateUsername('ab');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/3 characters/);
  });

  it('rejects username longer than 30 characters', () => {
    const result = validateUsername('a'.repeat(31));
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/30/);
  });

  it('rejects username with special characters', () => {
    const result = validateUsername('user@name');
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/alphanumeric/);
  });

  it('accepts valid alphanumeric username', () => {
    const result = validateUsername('JohnDoe42');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });
});

describe('sanitizeInput', () => {
  it('escapes HTML special characters', () => {
    const result = sanitizeInput('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands and quotes', () => {
    const result = sanitizeInput("Tom & Jerry's \"adventure\"");
    expect(result).toBe('Tom &amp; Jerry&#x27;s &quot;adventure&quot;');
  });

  it('returns plain text unchanged', () => {
    const result = sanitizeInput('Hello World 123');
    expect(result).toBe('Hello World 123');
  });
});
