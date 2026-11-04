"use client";

// The composer: type, speak or add a letter. Enter sends, Shift+Enter adds a line.

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Msg } from "./ChatPanel";

export function Composer({
  onSend,
  busy,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  push: (m: Omit<Msg, "id">) => void;
  setWorking: (s: string | null) => void;
}) {
  const [text, setText] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
    ta.current?.focus();
  };
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Message Beacon
      </label>
      <textarea
        id="chat-input"
        ref={ta}
        rows={2}
        placeholder="Tell Beacon about your situation"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        data-testid="chat-input"
      />
      <div className="row">
        <span className="spacer" />
        <button type="submit" className="send" disabled={!text.trim() || busy} aria-label="Send" data-testid="send">
          <Icon name="up" size={20} />
        </button>
      </div>
    </form>
  );
}
