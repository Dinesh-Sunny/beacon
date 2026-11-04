import type { ReactNode } from "react";

export function SectionHead({ tag, title, id, children, center }: { tag: string; title: ReactNode; id: string; children?: ReactNode; center?: boolean }) {
  return (
    <div className={`mk-shead${center ? " center" : ""}`}>
      <span className="mk-tag">{tag}</span>
      <h2 id={id}>{title}</h2>
      {children ? <p className="mk-lead">{children}</p> : null}
    </div>
  );
}
