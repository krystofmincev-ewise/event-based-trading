import { MARKET_CAP_CONTEXT } from "../lib/marketCapContext.js";
import { formatPercent } from "../lib/format.js";

const S_AND_P_SOURCE =
  "https://www.spglobal.com/spdji/en/documents/methodologies/methodology-sp-us-indices.pdf";
export const MarketCapContext = () => (
  <section
    id="market-context"
    className="market-context"
    aria-labelledby="market-context-title"
  >
    <div className="market-context-intro">
      <div>
        <span className="eyebrow">US equity research context</span>
        <h2 id="market-context-title">Size changes the evidence you need.</h2>
      </div>
      <p>
        These are dated market references—not strategy presets. They never
        invent a hit rate, event move, spread, or contract price.
      </p>
    </div>
    <div className="market-context-grid">
      {MARKET_CAP_CONTEXT.map((item, index) => (
        <article key={item.id}>
          <span className="context-index">0{index + 1}</span>
          <h3>{item.label}</h3>
          <dl>
            <div>
              <dt>S&amp;P addition range</dt>
              <dd>{item.eligibilityRange}</dd>
            </div>
            <div>
              <dt>Broad proxy</dt>
              <dd>
                <a
                  href={item.volatilitySourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.proxy} ↗
                </a>
              </dd>
            </div>
            <div>
              <dt>Proxy 3y standard deviation</dt>
              <dd>{formatPercent(item.threeYearStandardDeviation)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
    <div className="market-context-note">
      <p>
        S&amp;P Composite 1500 addition guidelines are from the July 2026
        methodology; ETF proxy standard deviations are as of June 30, 2026.
        Broad-index volatility is not the candidate stock&apos;s event
        volatility and is not used by this simulator. Use the actual executable
        quote, fee schedule, quote depth, and held-out calibration for the
        candidate trade.
      </p>
      <div>
        <a href={S_AND_P_SOURCE} target="_blank" rel="noreferrer">
          S&amp;P methodology ↗
        </a>
      </div>
    </div>
  </section>
);
