interface HeaderProps {
  status: "idle" | "loading" | "ready" | "error";
}

export const Header = ({ status }: HeaderProps) => (
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
    <nav aria-label="Page sections">
      <a href="#custom-lab">Custom lab</a>
      <a href="#kelly">Kelly sizing</a>
      <a href="#methodology">Methodology</a>
    </nav>
    <div
      className={`status-light status-${status}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {status === "loading"
        ? "Recomputing"
        : status === "error"
          ? "API issue"
          : "Local model"}
    </div>
  </header>
);
