export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_DURATION_DAYS = 5;
export const MIN_DURATION_DAYS = 1;
export const MIN_ESTIMATED_HOURS = 0.25;
export const MAX_ESTIMATED_HOURS = 999;
export const MIN_URGENCY = 1;
export const MAX_URGENCY = 5;
export const MIN_IMPORTANCE = 1;
export const MAX_IMPORTANCE = 5;
export const MAX_EMAIL_LENGTH = 254;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 100;

export const RECURRENCE_FREQS = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];
export const MAX_RECURRENCE_INTERVAL = 30;

export interface RecurrenceInput {
  freq: RecurrenceFreq;
  interval: number;
  until: string | null;
}

export type ValidationErrorCode =
  | "EMPTY_TITLE"
  | "TITLE_TOO_LONG"
  | "DESCRIPTION_TOO_LONG"
  | "CATEGORY_TOO_LONG"
  | "MALICIOUS_INPUT"
  | "DURATION_TOO_LONG"
  | "DURATION_TOO_SHORT"
  | "INVALID_ESTIMATED_HOURS"
  | "INVALID_URGENCY"
  | "INVALID_IMPORTANCE"
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "INVALID_TIME_RANGE"
  | "INVALID_RECURRENCE"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD";

export class ValidationError extends Error {
  code: ValidationErrorCode;
  constructor(code: ValidationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const TAG_PATTERN = /<[^>]*>/;
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
const REPEATED_CHAR_RUN_PATTERN = /(.)\1{9,}/u;
// Unicode-aware "letter or digit" — correctly counts Japanese kana/kanji as
// legitimate content, so all-Japanese titles are never flagged as symbol spam.
const LETTER_OR_DIGIT_PATTERN = /[\p{L}\p{N}]/u;

/**
 * Pragmatic, non-WAF heuristic for a plain-text title/description field:
 * hard-reject tag-like content, control chars, and symbol/repeat spam.
 */
export function isMaliciousInput(input: string): boolean {
  if (TAG_PATTERN.test(input)) return true;
  if (CONTROL_CHAR_PATTERN.test(input)) return true;
  if (REPEATED_CHAR_RUN_PATTERN.test(input)) return true;

  if (input.length > 5) {
    const letterOrDigitCount = [...input].filter((ch) =>
      LETTER_OR_DIGIT_PATTERN.test(ch),
    ).length;
    const nonLetterDigitRatio = 1 - letterOrDigitCount / input.length;
    if (nonLetterDigitRatio > 0.7) return true;
  }

  return false;
}

export function validateTitle(rawTitle: string): string {
  const title = rawTitle.trim();
  if (title.length === 0) {
    throw new ValidationError("EMPTY_TITLE", "タイトルを入力してください");
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(
      "TITLE_TOO_LONG",
      `タイトルは${MAX_TITLE_LENGTH}文字以内で入力してください`,
    );
  }
  if (isMaliciousInput(title)) {
    throw new ValidationError("MALICIOUS_INPUT", "処理できませんでした");
  }
  return title;
}

export function validateDescription(
  rawDescription: string | null | undefined,
): string | null {
  if (rawDescription == null) return null;
  const description = rawDescription.trim();
  if (description.length === 0) return null;
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new ValidationError(
      "DESCRIPTION_TOO_LONG",
      `説明は${MAX_DESCRIPTION_LENGTH}文字以内で入力してください`,
    );
  }
  if (isMaliciousInput(description)) {
    throw new ValidationError("MALICIOUS_INPUT", "処理できませんでした");
  }
  return description;
}

export function validateCategory(rawCategory: string | null | undefined): string | null {
  if (rawCategory == null) return null;
  const category = rawCategory.trim();
  if (category.length === 0) return null;
  if (category.length > MAX_CATEGORY_LENGTH) {
    throw new ValidationError(
      "CATEGORY_TOO_LONG",
      `カテゴリーは${MAX_CATEGORY_LENGTH}文字以内で入力してください`,
    );
  }
  if (isMaliciousInput(category)) {
    throw new ValidationError("MALICIOUS_INPUT", "処理できませんでした");
  }
  return category;
}

export function validateEstimatedHours(rawHours: number | null | undefined): number | null {
  if (rawHours == null) return null;
  if (
    typeof rawHours !== "number" ||
    !Number.isFinite(rawHours) ||
    rawHours < MIN_ESTIMATED_HOURS ||
    rawHours > MAX_ESTIMATED_HOURS
  ) {
    throw new ValidationError(
      "INVALID_ESTIMATED_HOURS",
      `所要時間は${MIN_ESTIMATED_HOURS}〜${MAX_ESTIMATED_HOURS}時間で入力してください`,
    );
  }
  return rawHours;
}

export function validateUrgency(rawUrgency: number | null | undefined): number | null {
  if (rawUrgency == null) return null;
  if (!Number.isInteger(rawUrgency) || rawUrgency < MIN_URGENCY || rawUrgency > MAX_URGENCY) {
    throw new ValidationError(
      "INVALID_URGENCY",
      `緊急度は${MIN_URGENCY}〜${MAX_URGENCY}の数字で選択してください`,
    );
  }
  return rawUrgency;
}

export function validateImportance(rawImportance: number | null | undefined): number | null {
  if (rawImportance == null) return null;
  if (
    !Number.isInteger(rawImportance) ||
    rawImportance < MIN_IMPORTANCE ||
    rawImportance > MAX_IMPORTANCE
  ) {
    throw new ValidationError(
      "INVALID_IMPORTANCE",
      `重要度は${MIN_IMPORTANCE}〜${MAX_IMPORTANCE}の数字で選択してください`,
    );
  }
  return rawImportance;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(rawEmail: string): string {
  const email = rawEmail.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError("INVALID_EMAIL", "メールアドレスの形式が正しくありません");
  }
  return email;
}

export function validatePassword(rawPassword: string): string {
  if (
    rawPassword.length < MIN_PASSWORD_LENGTH ||
    rawPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new ValidationError(
      "INVALID_PASSWORD",
      `パスワードは${MIN_PASSWORD_LENGTH}〜${MAX_PASSWORD_LENGTH}文字で入力してください`,
    );
  }
  return rawPassword;
}

export function validateDurationDays(durationDays: number): number {
  if (!Number.isInteger(durationDays) || durationDays < MIN_DURATION_DAYS) {
    throw new ValidationError(
      "DURATION_TOO_SHORT",
      "予定期間は1日以上にしてください",
    );
  }
  if (durationDays > MAX_DURATION_DAYS) {
    throw new ValidationError(
      "DURATION_TOO_LONG",
      `予定期間は${MAX_DURATION_DAYS}日以内にしてください`,
    );
  }
  return durationDays;
}

export function validateStartDate(rawStartDate: string): Date {
  const date = new Date(rawStartDate);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("INVALID_DATE", "日付が正しくありません");
  }
  return date;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateTime(rawTime: string): string {
  if (!TIME_PATTERN.test(rawTime)) {
    throw new ValidationError("INVALID_TIME", "時刻はHH:mm形式で入力してください");
  }
  return rawTime;
}

export function validateTimeRange(startTime: string, endTime: string): void {
  if (endTime <= startTime) {
    throw new ValidationError(
      "INVALID_TIME_RANGE",
      "終了時刻は開始時刻より後にしてください",
    );
  }
}

/**
 * Builds a canonical "FREQ=...;INTERVAL=...;UNTIL=..." rule string from form
 * input, validating ranges along the way. `null` input means "does not repeat".
 */
export function buildRecurrenceRule(
  input: RecurrenceInput | null,
  startDate: Date,
): string | null {
  if (input == null) return null;

  if (!RECURRENCE_FREQS.includes(input.freq)) {
    throw new ValidationError("INVALID_RECURRENCE", "繰り返しの種類が正しくありません");
  }
  if (
    !Number.isInteger(input.interval) ||
    input.interval < 1 ||
    input.interval > MAX_RECURRENCE_INTERVAL
  ) {
    throw new ValidationError(
      "INVALID_RECURRENCE",
      `繰り返しの間隔は1〜${MAX_RECURRENCE_INTERVAL}にしてください`,
    );
  }

  let untilPart = "";
  if (input.until != null) {
    const until = new Date(input.until);
    if (Number.isNaN(until.getTime())) {
      throw new ValidationError("INVALID_RECURRENCE", "繰り返しの終了日が正しくありません");
    }
    if (until.getTime() < startDate.getTime()) {
      throw new ValidationError(
        "INVALID_RECURRENCE",
        "繰り返しの終了日は開始日より後にしてください",
      );
    }
    const untilStamp = until.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    untilPart = `;UNTIL=${untilStamp}`;
  }

  return `FREQ=${input.freq};INTERVAL=${input.interval}${untilPart}`;
}

const RECURRENCE_RULE_PATTERN =
  /^FREQ=(DAILY|WEEKLY|MONTHLY);INTERVAL=(\d+)(?:;UNTIL=(\d{8}T\d{6}Z))?$/;

export function parseRecurrenceRule(rule: string | null): RecurrenceInput | null {
  if (rule == null) return null;
  const match = RECURRENCE_RULE_PATTERN.exec(rule);
  if (!match) return null;

  const [, freq, interval, until] = match;
  return {
    freq: freq as RecurrenceFreq,
    interval: Number(interval),
    until: until
      ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
      : null,
  };
}
