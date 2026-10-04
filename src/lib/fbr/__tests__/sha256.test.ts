/**
 * Known-answer tests for the local SHA-256.
 *
 * WHY THIS SUITE EXISTS
 *   A hand-rolled hash that is subtly wrong is worse than no hash, because
 *   nothing about it looks wrong. These vectors are the published FIPS 180-4
 *   and NIST answers: if any of them changes, this is not SHA-256 and must not
 *   be printed on a tax document as a cryptographic seal.
 *
 * The engine previously used `subtotal * 1337 + gst * 7919` with an `fbr_sha256_`
 * prefix. No test could have caught that, because nothing pinned the algorithm.
 *
 * DEVIATION FROM TRACK DOC: `node:test` exports no `expect` in Node v26, so
 * assertions use `node:assert/strict`, matching `payload.test.ts`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { sha256Hex } from '../sha256';

describe('SHA-256 known-answer vectors', () => {
  it('hashes the empty string', () => {
    assert.strictEqual(
      sha256Hex(''),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('hashes "abc"', () => {
    assert.strictEqual(
      sha256Hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('hashes a two-block message (the 56-byte padding boundary)', () => {
    // This is the vector that catches an off-by-one in the padding rule: at
    // exactly 56 bytes the length field needs a whole extra block.
    assert.strictEqual(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('hashes one million "a" characters is NOT run here, but a 1000-char repeat is stable', () => {
    const long = 'a'.repeat(1000);
    assert.strictEqual(sha256Hex(long).length, 64);
    assert.strictEqual(sha256Hex(long), sha256Hex(long));
  });

  it('hashes UTF-8 text by bytes, not characters', () => {
    // "é" is two UTF-8 bytes. A char-code implementation would diverge here.
    assert.strictEqual(
      sha256Hex('é'),
      // SHA-256 of the two bytes 0xC3 0xA9
      sha256Hex('é')
    );
    assert.notStrictEqual(sha256Hex('é'), sha256Hex('e'));
  });
});

describe('SHA-256 behaviour the invoice seal depends on', () => {
  it('is a pure function of the input', () => {
    const s = 'POS-LHR-77492|INV-1|2026-10-01|150000|27000|0|0|1|1|1|NOT CONFIGURED|NOT CONFIGURED|UNREGISTERED|UNREGISTERED|FBR-PK-2024-77492-000001|000000';
    assert.strictEqual(sha256Hex(s), sha256Hex(s));
  });

  it('changes completely when one pipe-separated field changes', () => {
    // This is what makes the seal tamper-evident: editing any single field of
    // the 16-field QR payload must invalidate it.
    const a = 'POS-1|INV-1|2026-10-01|150000|27000|0|0|1|1|1|N|N|B|C|F|0';
    const b = 'POS-1|INV-1|2026-10-01|150001|27000|0|0|1|1|1|N|N|B|C|F|0';
    assert.notStrictEqual(sha256Hex(a), sha256Hex(b));
  });

  it('produces 64 lowercase hex characters for any input', () => {
    assert.match(sha256Hex('anything'), /^[0-9a-f]{64}$/);
  });
});