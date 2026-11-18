// The page's style nonce (bipnip). The host that serves the page (bipnip-webhost) puts a fresh
// nonce on every <script> and <style> tag of each page it serves and allows only styles that carry
// it (CSP `style-src 'self' 'nonce-…'`). Styles the UI adds while it runs (emotion's, the style
// loader's) must carry the same nonce, so it is read off the page's own script tag.
//
// Browsers hide a nonce attribute's value once the page has loaded; the element's `nonce` property
// keeps it.

/** The nonce of the page's scripts, or undefined when the page was served without one. */
export function readNonce(doc: Pick<Document, 'querySelector'> | undefined): string | undefined {
  const script = doc?.querySelector('script[nonce]') as HTMLScriptElement | null | undefined;
  const nonce = script?.nonce;
  return nonce !== undefined && nonce !== '' ? nonce : undefined;
}

/** This page's nonce. */
export const pageNonce: string | undefined = readNonce(
  typeof document === 'undefined' ? undefined : document,
);
