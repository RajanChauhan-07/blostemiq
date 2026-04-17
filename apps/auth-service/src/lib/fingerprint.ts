import { Request } from 'express';
import { createHash } from 'crypto';
import UAParser from 'ua-parser-js';

/**
 * Creates a device fingerprint from request headers.
 * NOT used for tracking — only for refresh token binding
 * to detect stolen token usage from a different device.
 */
export function getDeviceFingerprint(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const parser = new UAParser(ua);
  const result = parser.getResult();

  const components = [
    result.browser.name || '',
    result.os.name || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
  ].join('|');

  return createHash('sha256').update(components).digest('hex').slice(0, 16);
}
