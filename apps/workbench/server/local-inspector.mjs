import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

export const LIMITS = Object.freeze({ body: 12 * 1024 * 1024, archive: 8 * 1024 * 1024, output: 2 * 1024 * 1024, timeout: 10000 });
export class InspectorError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const fail = (code, status) => { throw new InspectorError(code, status); };
export function localAccess(request, env = process.env) {
  if (env.TACITUS_LOCAL_INSPECTOR !== '1' || env.NODE_ENV === 'production' || env.VERCEL || env.K_SERVICE) fail('inspector_disabled', 404);
  let origin;
  try { origin = new URL(env.TACITUS_INSPECTOR_ORIGIN); } catch { fail('inspector_disabled', 404); }
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.pathname !== '/') fail('inspector_disabled', 404);
  if (request.headers.get('host') !== origin.host || request.headers.get('origin') !== origin.origin ||
      !['same-origin', null].includes(request.headers.get('sec-fetch-site'))) fail('origin_denied', 403);
}
export async function boundedBody(request, limit = LIMITS.body, timeout = LIMITS.timeout) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') fail('json_required', 415);
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) fail('body_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) fail('body_required');
  const chunks = []; let size = 0;
  let expired = false;
  const timer = setTimeout(() => { expired = true; reader.cancel().catch(() => {}); }, timeout);
  try {
    while (true) {
      if (request.signal.aborted) fail('cancelled', 499);
      const { done, value } = await reader.read();
      if (expired) fail('body_timeout', 408);
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); fail('body_too_large', 413); }
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('invalid_json'); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
export function validateInput(input) {
  if (!input || !['inspect', 'reuse'].includes(input.operation)) fail('operation_denied');
  if (typeof input.archive !== 'string' || input.archive.length > Math.ceil(LIMITS.archive / 3) * 4) fail('archive_too_large', 413);
  const archive = Buffer.from(input.archive, 'base64');
  if (archive.toString('base64') !== input.archive) fail('invalid_archive');
  if (!archive.length || archive.length > LIMITS.archive) fail('archive_too_large', 413);
  if (!archive.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) fail('invalid_archive');
  let query;
  if (input.operation === 'reuse') {
    const q = input.query;
    if (!q || typeof q.question !== 'string' || !q.question.trim() || Buffer.byteLength(q.question) > 8000 ||
        !['disclose_unknown', 'require_declared_interval'].includes(q.time_mode) ||
        !Number.isSafeInteger(q.max_bytes) || q.max_bytes < 2048 || q.max_bytes > 250000 ||
        ![q.known_as_of, q.valid_at].every(v => Number.isSafeInteger(v)) ||
        !Array.isArray(q.revoked_sources) || q.revoked_sources.length > 100 ||
        !q.revoked_sources.every(v => typeof v === 'string' && v.length <= 256)) fail('invalid_query');
    query = { question: q.question, known_as_of: q.known_as_of, valid_at: q.valid_at, time_mode: q.time_mode, max_bytes: q.max_bytes, revoked_sources: q.revoked_sources };
  }
  return { operation: input.operation, archive, query };
}
export function runCore(binary, args, stdin, { signal, timeout = LIMITS.timeout, output = LIMITS.output } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new InspectorError('cancelled', 499));
    const env = Object.fromEntries(['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    const child = spawn(binary, args, { shell: false, windowsHide: true, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = []; let size = 0; let error; let stderr = ''; let settled = false;
    const stop = (code, status) => { error ??= new InspectorError(code, status); child.kill('SIGKILL'); };
    const abort = () => stop('cancelled', 499);
    const timer = setTimeout(() => stop('core_timeout', 504), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    const finish = (err, value) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (err) reject(err); else resolve(value);
    };
    child.stdout.on('data', data => { size += data.length; if (size > output) stop('core_output_limit', 502); else chunks.push(data); });
    child.stderr.on('data', data => { size += data.length; if (size > output) stop('core_output_limit', 502); else stderr += data.toString('utf8'); });
    child.on('error', () => finish(new InspectorError('core_unavailable', 503)));
    child.stdin.on('error', () => {});
    child.on('close', code => {
      if (error) return finish(error);
      if (code !== 0) {
        const errors = [
          [/graph artifact|knowledge artifact|profile/i, 'unsupported_profile'],
          [/unknown validity|strict date request/, 'unknown_validity'],
          [/graph revision unavailable/, 'historical_revision_required'],
          [/revoked source/, 'revoked_source'],
          [/expired source|unavailable or expired/, 'source_unavailable'],
          [/capsule validity expired/, 'capsule_expired'],
          [/budget cannot hold/, 'budget_too_small'],
        ];
        return finish(new InspectorError(errors.find(([pattern]) => pattern.test(stderr))?.[1] ?? 'archive_or_query_rejected', 422));
      }
      const bytes = Buffer.concat(chunks);
      try { JSON.parse(bytes.toString('utf8')); } catch { return finish(new InspectorError('invalid_core_output', 502)); }
      if (args[0] === 'reuse' && bytes.length > JSON.parse(stdin).max_bytes) return finish(new InspectorError('core_output_limit', 502));
      finish(null, bytes);
    });
    child.stdin.end(stdin);
  });
}
export function createInspector({ binary, digest, runner = runCore, tempRoot = tmpdir() }) {
  let active = false;
  return async (input, signal, onVerified = () => {}) => {
    if (!binary || !isAbsolute(binary) || !/^[a-f0-9]{64}$/.test(digest ?? '')) fail('core_not_configured', 503);
    if (active) fail('inspector_busy', 429);
    active = true; let directory;
    try {
      const data = validateInput(input);
      if (createHash('sha256').update(await readFile(binary)).digest('hex') !== digest) fail('core_digest_mismatch', 503);
      if (signal?.aborted) fail('cancelled', 499);
      directory = await mkdtemp(join(tempRoot, 'tacitus-inspect-'));
      const capsule = join(directory, 'capsule.zip');
      await writeFile(capsule, data.archive, { flag: 'wx', mode: 0o600 });
      // Identity is a pre-invocation check of a trusted local file, not immutable execution attestation.
      onVerified(digest);
      return await runner(binary, [data.operation, capsule], data.query ? JSON.stringify(data.query) : '', { signal });
    } finally {
      try { if (directory) await rm(directory, { recursive: true, force: true }); } finally { active = false; }
    }
  };
}
