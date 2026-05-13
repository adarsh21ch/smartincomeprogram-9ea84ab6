// Shared helpers for lead/registration form inputs.
// Keeps the public funnel, landing page, live page, private lead form, and
// multi-step viewer consistent in how they accept user input.

/** Strip all non-digit chars; trim leading +91 / 91 / 0 so users typing
 * "+919876543210", "919876543210", or "09876543210" all normalize to a
 * 10-digit Indian mobile number. */
export const normalizeIndianPhone = (raw: string): string => {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length > 10) digits = digits.replace(/^0+/, "");
  return digits.slice(0, 10);
};

/** True when a normalized 10-digit Indian mobile number is valid (starts 6-9). */
export const isValidIndianPhone = (raw: string): boolean => {
  const d = normalizeIndianPhone(raw);
  return /^[6-9]\d{9}$/.test(d);
};

/** Cleanup whitespace from any free-text input. */
export const cleanText = (raw: string): string =>
  (raw || "").replace(/\s+/g, " ").trim();

/** Lowercase + trim, the canonical form for emails. */
export const cleanEmail = (raw: string): string =>
  (raw || "").trim().toLowerCase();

/** Basic email shape check (intentionally permissive — server is the source of truth). */
export const isValidEmail = (raw: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(raw));

/** Common attribute bundles to spread onto <Input/> / <input/> for premium UX. */
export const phoneInputProps = {
  type: "tel" as const,
  inputMode: "numeric" as const,
  autoComplete: "tel-national",
  pattern: "[0-9]*",
  maxLength: 10,
};

export const emailInputProps = {
  type: "email" as const,
  inputMode: "email" as const,
  autoComplete: "email",
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
};

export const nameInputProps = {
  type: "text" as const,
  autoComplete: "name",
  autoCapitalize: "words",
  spellCheck: false,
};
