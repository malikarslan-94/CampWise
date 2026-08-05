import { getLogger } from '../lib/logger.js';

/**
 * Bot check on session creation.
 *
 * reCAPTCHA rather than Turnstile because the web surface already ships it
 * (`react-google-recaptcha`, `VITE_captchaKey`) and upstream's own OTP endpoint
 * already expects a `captchaToken` — so it is one fewer vendor and one fewer thing
 * for the app teams to add.
 *
 * Worth being clear about what this does and does not buy: it guards session
 * *creation*, not session *use*. A pass, once minted, can be reused until it expires,
 * and solving services are cheap. It raises the cost of farming passes; the rate
 * limits and the Anthropic spend cap are what actually bound the damage.
 *
 * Injectable so tests never touch the network. For local development, Google
 * publishes always-passing test keys — use those rather than adding a bypass flag,
 * which would eventually ship enabled.
 */
export interface CaptchaVerifier {
  verify(token: string, remoteIp?: string): Promise<boolean>;
}

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export class RecaptchaVerifier implements CaptchaVerifier {
  constructor(private readonly secret: string) {}

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    if (!token) return false;

    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    try {
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5_000),
      });

      const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      if (!data.success) {
        getLogger({}).warn({ event: 'captcha_rejected', codes: data['error-codes'] }, 'captcha_rejected');
      }
      return data.success === true;
    } catch (err) {
      // Fail closed. An unreachable verifier means we cannot tell a human from a
      // script, and this endpoint costs money to serve.
      getLogger({}).error({ event: 'captcha_error', err: String(err) }, 'captcha_error');
      return false;
    }
  }
}
