// bipnip: imported first by the entry (`index.js`), before any module that may add a <style>.
// webpack's style loader puts `__webpack_nonce__` on the <style> tags it adds; it must be set
// before the first of them is added. See `utils/nonce.ts`.
import { pageNonce } from './utils/nonce';

// Read and replaced by webpack (`__webpack_require__.nc`).
// eslint-disable-next-line @typescript-eslint/naming-convention
declare let __webpack_nonce__: string | undefined;

if (pageNonce !== undefined) {
  __webpack_nonce__ = pageNonce;
}

export {};
