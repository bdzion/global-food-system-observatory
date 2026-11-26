
/* A picture of how food reaches people.
 *
 * This is the thing a newcomer needs before any of the figures below make
 * sense: five links, in order, with the kind of trouble that can start at
 * each one and where imports enter. It is a schematic, not a measured flow
 * model, and the caption says so — the widths and the spacing carry no
 * quantity.
 *
 * It is hidden on narrow screens, where a 980-wide drawing would shrink the
 * labels below the size anyone can read. The numbered cards underneath carry
 * the same five stages in the same order, so nothing is lost on a phone. */

const STAGES = [
  {
    n: "1",
    lines: ["Inputs"],
    trouble: ["Fertilizer and fuel", "cost more"],
  },
  {
    n: "2",
    lines: ["Farms"],
    trouble: ["A harvest fails"],
  },
  {
    n: "3",
    lines: ["Storage and", "processing"],
    trouble: ["Stores run low"],
  },
  {
    n: "4",
    lines: ["Trade and", "transport"],
    trouble: ["A route or", "supplier stops"],
  },
  {
    n: "5",
    lines: ["Markets and", "households"],
    trouble: ["Food costs more", "than people can pay"],
  },
];

const X0 = 24;
const W = 168;
const GAP = 35;
const TOP = 126;
const H = 72;
const x = (i: number) => X0 + i * (W + GAP);
const cx = (i: number) => x(i) + W / 2;

export function SystemMap() {
  return (
    <figure className="system-map">
      <svg
        viewBox="0 0 1028 322"
        role="img"
        aria-label="Food reaches people through five linked stages: inputs, farms, storage and processing, trade and transport, and markets and households. Trouble can start at any one of them, and imports enter at the trade stage."
      >
        <defs>
          <marker
            id="system-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill="var(--line)" />
          </marker>
        </defs>

        <text x={X0} y="26" fontSize="15" fontWeight="650" fill="currentColor">
          Trouble can start at any link, a long way from the people who feel it
        </text>
        <text x={X0} y="48" fontSize="11.5" fill="currentColor" opacity="0.72">
          A schematic of the order things happen in, not a measured flow. The cards below say what we can and cannot watch at each stage.
        </text>

        {/* Imports join the chain at the trade stage; exports leave from it. */}
        <g stroke="var(--line)" strokeWidth="1.25" fill="none">
          <path d={`M${cx(3)} 80V${TOP}`} markerEnd="url(#system-arrow)" />
        </g>
        <text x={cx(3)} y="72" textAnchor="middle" fontSize="11.5" fill="currentColor" opacity="0.72">
          Imported food joins here
        </text>

        {/* The chain itself. */}
        <g stroke="var(--line)" strokeWidth="1.25" fill="none">
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${x(i) + W} ${TOP + H / 2}H${x(i + 1)}`}
              markerEnd="url(#system-arrow)"
            />
          ))}
        </g>

        {STAGES.map((stage, i) => (
          <g key={stage.n}>
            <rect
                x={x(i)}
                y={TOP}
                width={W}
                height={H}
                rx="8"
                fill="var(--accent-soft)"
                stroke="var(--line)"
                strokeWidth="1.25"
              />
              <text x={x(i) + 12} y={TOP + 20} fontSize="11" fontWeight="650" fill="currentColor" opacity="0.6">
                {stage.n}
              </text>
              {stage.lines.map((line, k) => (
                <text
                  key={line}
                  x={cx(i)}
                  y={TOP + (stage.lines.length === 1 ? 46 : 40 + k * 18)}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="650"
                  fill="currentColor"
                >
                  {line}
                </text>
              ))}
            <line
              x1={cx(i)}
              y1={TOP + H}
              x2={cx(i)}
              y2={TOP + H + 16}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {stage.trouble.map((line, k) => (
              <text
                key={line}
                x={cx(i)}
                y={TOP + H + 32 + k * 15}
                textAnchor="middle"
                fontSize="11.5"
                fill="currentColor"
                opacity="0.78"
              >
                {line}
              </text>
            ))}
          </g>
        ))}

        <rect
          x={X0}
          y="272"
          width={1028 - 2 * X0}
          height="36"
          rx="8"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1.25"
          strokeDasharray="4 4"
        />
        <text x="514" y="295" textAnchor="middle" fontSize="12.5" fill="currentColor">
          Running through all five: energy prices, money to buy with, trade rules, weather and government decisions
        </text>
      </svg>
      <figcaption>
        Whether trouble at one link reaches the next depends on what sits in
        between: other suppliers to call, food in store, and money to buy with.
        That is what the rest of this site measures.
      </figcaption>
    </figure>
  );
}
