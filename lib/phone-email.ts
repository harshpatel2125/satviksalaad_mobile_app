// Phone-only accounts carry a synthetic email on this domain; it is never mailed.
const PHONE_EMAIL_DOMAIN = '@auth.satviksalaad.in';

export function isPhoneEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(PHONE_EMAIL_DOMAIN));
}

export function phoneFromEmail(email: string | null | undefined): string | null {
  return isPhoneEmail(email) ? email!.slice(0, -PHONE_EMAIL_DOMAIN.length) : null;
}
