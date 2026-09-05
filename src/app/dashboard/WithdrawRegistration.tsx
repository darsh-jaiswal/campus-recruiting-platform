"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  withdrawRegistration,
  type WithdrawRegistrationState,
} from "./actions";

/**
 * The registration-withdrawal control: collapsed by default, expands to a
 * type-WITHDRAW-to-confirm form. The consequences are stated before the
 * button, not after — no refund, out of every shortlist, reversal only by
 * contacting the organisers.
 */

const INITIAL: WithdrawRegistrationState = { status: "idle" };

export function WithdrawRegistration() {
  const [state, action, pending] = useActionState(withdrawRegistration, INITIAL);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (state.status === "withdrawn") {
    return (
      <section className="mt-14 rounded border border-hairline bg-raised p-6">
        <p className="text-sm font-semibold text-navy">
          Your registration is withdrawn.
        </p>
        <p className="mt-1 text-sm text-slate">
          You are out of the screening pipeline and your applications show as
          withdrawn. Contact the organising team if you change your mind.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="withdraw-registration" className="mt-14">
      <h2
        id="withdraw-registration"
        className="text-eyebrow font-semibold uppercase text-muted"
      >
        Withdraw
      </h2>

      {!open ? (
        <p className="mt-3 text-sm text-muted">
          Leaving Aspire Quest?{" "}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-semibold text-slate underline-offset-4 hover:text-critical hover:underline"
          >
            Withdraw your registration
          </button>
        </p>
      ) : (
        <div className="mt-4 max-w-[62ch] rounded border border-hairline-strong bg-amber-wash p-5">
          <p className="text-sm font-semibold text-navy">
            This withdraws your whole registration.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate">
            <li>You leave the screening pipeline and every shortlist.</li>
            <li>All your opening applications are withdrawn with it.</li>
            <li>The registration fee is not refunded (see the refund policy).</li>
            <li>Reversal is by emailing the organising team — not self-service.</li>
          </ul>

          <form action={action} className="mt-4">
            <label
              htmlFor="withdraw-confirm"
              className="block text-sm text-slate"
            >
              Type <span className="font-semibold text-navy">WITHDRAW</span> to
              confirm
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                id="withdraw-confirm"
                name="confirm"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                className="w-40 rounded border border-hairline-strong bg-surface px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={pending || typed !== "WITHDRAW"}
                className="rounded border border-critical px-4 py-2 text-sm font-semibold text-critical transition-colors hover:bg-critical hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? "Withdrawing…" : "Withdraw registration"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                }}
                className="text-sm text-muted underline-offset-4 hover:underline"
              >
                Never mind
              </button>
            </div>
            {state.status === "error" ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-critical">
                {state.message}
              </p>
            ) : null}
          </form>
        </div>
      )}
    </section>
  );
}
