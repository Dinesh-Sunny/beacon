import { type FormEvent, startTransition } from "react";

// React 19 resets a <form action> after every submit, even when the action returns an error,
// which wipes what people typed. Forms whose fields should survive an error submit through this
// instead: browser validation still runs first, and useActionState still tracks pending.
export function submitKeepingValues(action: (form: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => action(form));
  };
}
