import { useState } from "react";
import { ApiRequestError } from "../lib/errors";

interface PendingDuplicate<TInput> {
  title: string;
  input: TInput;
}

/**
 * Wraps a mutateAsync call that may reject with a DUPLICATE_TITLE (409).
 * On conflict, submit() resolves to "duplicate" instead of throwing, and the
 * caller renders <DuplicateTitleDialog> driven by the returned state.
 */
export function useDuplicateTitleGuard<TInput extends { force?: boolean }>(
  mutateAsync: (input: TInput) => Promise<unknown>,
) {
  const [pending, setPending] = useState<PendingDuplicate<TInput> | null>(null);

  async function submit(title: string, input: TInput): Promise<"ok" | "duplicate" | "error"> {
    try {
      await mutateAsync(input);
      return "ok";
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "DUPLICATE_TITLE") {
        setPending({ title, input });
        return "duplicate";
      }
      throw err;
    }
  }

  async function confirmCreateAnyway() {
    if (!pending) return;
    await mutateAsync({ ...pending.input, force: true });
    setPending(null);
  }

  function cancel() {
    setPending(null);
  }

  return { pending, submit, confirmCreateAnyway, cancel };
}
