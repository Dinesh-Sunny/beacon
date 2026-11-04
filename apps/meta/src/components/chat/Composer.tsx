"use client";

// The composer: type, speak or add a letter. Enter sends, Shift+Enter adds a line.
// Speaking records to WAV in the browser; Muse Voice Transcribe turns it into text.

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { type Recorder, startRecording } from "@/lib/wav";

const MAX_SECONDS = 90;

export function Composer({
  onSend,
  onVoice,
  onPhoto,
  busy,
}: {
  onSend: (text: string) => void;
  onVoice: (wav: Blob) => void;
  onPhoto: (file: File) => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [rec, setRec] = useState<Recorder | null>(null);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [micError, setMicError] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rec) return;
    const started = Date.now();
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSecs(s);
      setLevels((l) => [...l.slice(-39), rec.level()]);
      if (s >= MAX_SECONDS) void stop();
    }, 100);
    return () => clearInterval(t);
    // biome-ignore lint/correctness/useExhaustiveDependencies: stop is stable for one recording
  }, [rec]);

  const submit = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
    ta.current?.focus();
  };

  const start = async () => {
    setMicError("");
    try {
      setLevels([]);
      setSecs(0);
      setRec(await startRecording());
    } catch {
      setMicError("Your browser didn't let Beacon use the microphone. You can allow it in the address bar, or type instead.");
    }
  };
  const stop = async () => {
    if (!rec) return;
    const r = rec;
    setRec(null);
    const wav = await r.stop();
    onVoice(wav);
  };
  const cancel = () => {
    rec?.cancel();
    setRec(null);
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setMenu(false);
    if (f) onPhoto(f);
  };

  if (rec)
    return (
      <div className="composer recording" data-testid="recording">
        <div className="rec">
          <span className="dot" aria-hidden="true" />
          <span>
            Listening {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          </span>
          <span className="bars" aria-hidden="true">
            {levels.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length meter
              <i key={i} style={{ height: `${Math.max(8, Math.min(100, l * 260))}%` }} />
            ))}
          </span>
        </div>
        <div className="row">
          <button type="button" className="btn ghost small" onClick={cancel}>
            Cancel
          </button>
          <span className="spacer" />
          <button type="button" className="btn small" onClick={() => void stop()} data-testid="stop-rec">
            <Icon name="check" size={18} /> Done
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {micError && <p className="hint mic-error">{micError}</p>}
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
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} data-testid="file-input" />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <div className="row">
        <div className="menu-wrap">
          <button type="button" className="iconbtn" aria-label="Add" aria-expanded={menu} onClick={() => setMenu((m) => !m)} data-testid="add">
            <Icon name="plus" />
          </button>
          {menu && (
            <div className="menu up" role="menu">
              <button type="button" role="menuitem" onClick={() => file.current?.click()} data-testid="add-letter">
                <b>
                  <Icon name="upload" size={18} /> Add a letter or photo
                </b>
                <span>An agent reads it for you</span>
              </button>
              <button type="button" role="menuitem" onClick={() => camera.current?.click()}>
                <b>
                  <Icon name="camera" size={18} /> Take a photo
                </b>
                <span>Best on a phone</span>
              </button>
            </div>
          )}
        </div>
        <span className="spacer" />
        {text.trim() ? (
          <button type="submit" className="send" disabled={busy} aria-label="Send" data-testid="send">
            <Icon name="up" size={20} />
          </button>
        ) : (
          <button type="button" className="send mic" onClick={() => void start()} disabled={busy} aria-label="Speak" data-testid="mic">
            <Icon name="mic" size={20} />
          </button>
        )}
      </div>
    </form>
  );
}
