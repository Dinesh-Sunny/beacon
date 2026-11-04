"use client";

export function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="thread">
      <div className="msg bot">
        <div className="bubble">Hello, I'm Beacon. Answer the questions on the right, or tell me about your situation here.</div>
      </div>
      <button type="button" className="linkbtn" onClick={onClose} hidden>
        Hide
      </button>
    </div>
  );
}
