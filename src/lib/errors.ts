export const FALLBACK_MESSAGE = "処理できませんでした";

export interface ApiErrorPayload {
  code: string;
  message: string;
  conflictingTaskId?: string;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  conflictingTaskId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || FALLBACK_MESSAGE);
    this.status = status;
    this.code = payload.code;
    this.conflictingTaskId = payload.conflictingTaskId;
  }
}

const KNOWN_CODE_MESSAGES: Record<string, string> = {
  EMPTY_TITLE: "タイトルを入力してください",
  TITLE_TOO_LONG: "タイトルが長すぎます",
  DESCRIPTION_TOO_LONG: "説明が長すぎます",
  CATEGORY_TOO_LONG: "カテゴリーが長すぎます",
  INVALID_ESTIMATED_HOURS: "所要時間が正しくありません",
  DURATION_TOO_LONG: "予定期間は5日以内にしてください",
  DURATION_TOO_SHORT: "予定期間は1日以上にしてください",
  INVALID_DATE: "日付が正しくありません",
  INVALID_EMAIL: "メールアドレスの形式が正しくありません",
  INVALID_PASSWORD: "パスワードは8〜100文字で入力してください",
  INVALID_CREDENTIALS: "メールアドレスまたはパスワードが正しくありません",
  EMAIL_TAKEN: "このメールアドレスは既に登録されています",
  UNAUTHORIZED: "ログインが必要です",
};

export function messageForError(err: unknown): string {
  if (err instanceof ApiRequestError) {
    return KNOWN_CODE_MESSAGES[err.code] ?? err.message ?? FALLBACK_MESSAGE;
  }
  return FALLBACK_MESSAGE;
}
