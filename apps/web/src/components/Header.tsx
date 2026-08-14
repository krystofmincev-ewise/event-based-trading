import type { MouseEvent } from "react";

interface HeaderProps {
  status: "idle" | "loading" | "ready" | "error";
  issueKind:
    | "input"
    | "malformed"
    | "unavailable"
    | "rejected"
    | "unknown"
    | undefined;
}

const closeCompactMenu = (event: MouseEvent<HTMLAnchorElement>) => {
  event.currentTarget.closest("details")?.removeAttribute("open");
};

export const Header = ({ status, issueKind }: HeaderProps) => (
  <header className="masthead">
    <a className="brand" href="#top" aria-label="Event Edge Lab home">
      <span className="brand-mark" aria-hidden="true">
        EE
      </span>
      <span>
        <strong>Event Edge</strong>
        <small>Position sizing laboratory</small>
      </span>
    </a>
    <nav className="desktop-nav" aria-label="Page sections">
      <a href="#custom-lab">Custom lab</a>
      <a href="#kelly">Kelly sizing</a>
      <a href="#methodology">Methodology</a>
    </nav>
    <details className="compact-nav">
      <summary>Sections</summary>
      <nav aria-label="Compact page sections">
        <a href="#custom-lab" onClick={closeCompactMenu}>
          Custom lab
        </a>
        <a href="#kelly" onClick={closeCompactMenu}>
          Kelly sizing
        </a>
        <a href="#methodology" onClick={closeCompactMenu}>
          Methodology
        </a>
      </nav>
    </details>
    <div
      className={`status-light status-${status}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {status === "loading"
        ? "Recomputing"
        : status === "error"
          ? issueKind === "input"
            ? "Input issue"
            : issueKind === "malformed"
              ? "Data issue"
              : "API issue"
          : "Local model"}
    </div>
  </header>
);
