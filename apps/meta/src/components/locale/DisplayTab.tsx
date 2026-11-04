"use client";

// The Display tab (Figma Kit 10, P4 and P4b): a live preview, eight comfort presets chosen by
// need, then every setting on its own (text size, twelve tiles, read-aloud speed). Changes apply
// at once on every page; Back to standard undoes them all.

import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { Icon } from "@/components/Icon";
import { intlTag } from "@/i18n/locales";
import {
  PRESETS,
  type Preset,
  SETTINGS,
  type Setting,
  SPEEDS,
  type Speed,
  useDisplay,
} from "@/lib/display";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech";

const PRESET_ICON: Record<Preset, string> = {
  read: "doc",
  colours: "spark",
  bigger: "search",
  listen: "speaker",
  calmer: "sun",
  focus: "shield",
  simple: "chat",
  tap: "check",
};

export function DisplayTab({ onDone }: { onDone: () => void }) {
  const t = useTranslations("display");
  const locale = useLocale();
  const { display, set, toggle, presetState, togglePreset, changes, reset } =
    useDisplay();
  const [each, setEach] = useState(false);
  const [playing, setPlaying] = useState(false);

  const play = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    await speak([t("previewTitle"), t("previewBody")], intlTag(locale));
    setPlaying(false);
  };

  return (
    <div className="pd-display">
      {each && (
        <button
          type="button"
          className="linkbtn pd-back"
          onClick={() => setEach(false)}
        >
          <Icon name="back" size={16} /> {t("back")}
        </button>
      )}
      <div className="pd-preview" aria-live="polite">
        {canSpeak() && (
          <button
            type="button"
            className="btn ghost small pd-play"
            onClick={() => void play()}
            aria-pressed={playing}
          >
            <Icon name={playing ? "stop" : "speaker"} size={16} />{" "}
            {playing ? t("stop") : t("play")}
          </button>
        )}
        <b>{t("previewTitle")}</b>
        <p>
          {display.on.includes("simple")
            ? t("previewSimple")
            : t("previewBody")}
        </p>
      </div>

      {!each ? (
        <>
          <ul className="pd-presets">
            {(Object.keys(PRESETS) as Preset[]).map((p) => {
              const state = presetState(p);
              return (
                <li key={p}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={
                      state === "on"
                        ? true
                        : state === "partly"
                          ? "mixed"
                          : false
                    }
                    className={`pd-preset ${state}`}
                    onClick={() => togglePreset(p)}
                    data-testid={`preset-${p}`}
                  >
                    <span className="pd-ico" aria-hidden="true">
                      <Icon name={PRESET_ICON[p]} size={18} />
                    </span>
                    <span>
                      <b>{t(`preset.${p}`)}</b>
                      <small>{t(`need.${p}`)}</small>
                    </span>
                    <span className="pd-box" aria-hidden="true">
                      {state === "on" ? (
                        <Icon name="check" size={14} />
                      ) : state === "partly" ? (
                        <Icon name="minus" size={14} />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className="pd-each"
            onClick={() => setEach(true)}
            data-testid="each-setting"
          >
            <Icon name="dots" size={18} /> {t("each")}
            {changes > 0 && <em>{t("changes", { count: changes })}</em>}
            <Icon name="arrow" size={16} />
          </button>
        </>
      ) : (
        <>
          <div className="pd-line">
            <span id="pd-size">{t("textSize")}</span>
            <div className="seg" role="radiogroup" aria-labelledby="pd-size">
              {([0, 1, 2, 3] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={display.size === s}
                  aria-label={t(`size.${s}`)}
                  onClick={() => set({ ...display, size: s })}
                  style={{ fontSize: `${0.75 + s * 0.15}rem` }}
                >
                  A
                </button>
              ))}
            </div>
          </div>
          <ul className="pd-tiles">
            {SETTINGS.map((s: Setting) => (
              <li key={s}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={display.on.includes(s)}
                  className={`pd-tile${display.on.includes(s) ? " on" : ""}`}
                  onClick={() => toggle(s)}
                  data-testid={`setting-${s}`}
                >
                  <span className={`pd-swatch sw-${s}`} aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <span className="pd-tile-name">
                    <span className="pd-box" aria-hidden="true">
                      {display.on.includes(s) && (
                        <Icon name="check" size={12} />
                      )}
                    </span>
                    {t(`setting.${s}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="pd-line">
            <span id="pd-speed">{t("speed")}</span>
            <div className="seg" role="radiogroup" aria-labelledby="pd-speed">
              {(Object.keys(SPEEDS) as Speed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={display.speed === s}
                  onClick={() => set({ ...display, speed: s })}
                >
                  {t(`speeds.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <p className="pd-note">{t("systemWins")}</p>
      <div className="pd-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={reset}
          disabled={!changes}
        >
          {t("standard")}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          {t("done")} <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}
