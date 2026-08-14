import type { KeyboardEvent, ReactNode } from "react";

interface HorizontalScrollRegionProps {
  label: string;
  className?: string;
  children: ReactNode;
}

const scrollWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
  const region = event.currentTarget;
  const increment = Math.max(160, region.clientWidth * 0.65);
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    region.scrollBy({
      left: event.key === "ArrowLeft" ? -increment : increment,
      behavior: "auto",
    });
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    region.scrollTo({
      left: event.key === "Home" ? 0 : region.scrollWidth,
      behavior: "auto",
    });
  }
};

export const HorizontalScrollRegion = ({
  label,
  className,
  children,
}: HorizontalScrollRegionProps) => (
  <div className="horizontal-scroll-shell">
    <div
      className={`horizontal-scroll${className ? ` ${className}` : ""}`}
      role="region"
      aria-label={`${label}, horizontally scrollable`}
      tabIndex={0}
      onKeyDown={scrollWithKeyboard}
    >
      {children}
    </div>
    <span className="scroll-hint" aria-hidden="true">
      Swipe or use ← → for more
    </span>
  </div>
);
