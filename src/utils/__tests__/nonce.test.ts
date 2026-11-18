/**
 * Tests for readNonce (bipnip): the style nonce is read off the page's own script tag.
 */

import { readNonce } from '../nonce';

function page(found: { nonce?: string } | null): Pick<Document, 'querySelector'> {
  return {
    querySelector: ((selector: string) => {
      expect(selector).toBe('script[nonce]');
      return found;
    }) as Document['querySelector'],
  };
}

describe('readNonce', () => {
  it('reads the nonce property of the first script that has one', () => {
    expect(readNonce(page({ nonce: 'aGVsbG8gbm9uY2UgMTIz' }))).toBe('aGVsbG8gbm9uY2UgMTIz');
  });

  it('is undefined without a document, a script or a nonce', () => {
    expect(readNonce(undefined)).toBeUndefined();
    expect(readNonce(page(null))).toBeUndefined();
    expect(readNonce(page({}))).toBeUndefined();
    expect(readNonce(page({ nonce: '' }))).toBeUndefined();
  });
});
