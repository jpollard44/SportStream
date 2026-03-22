/**
 * BaseDiamond — SVG baseball diamond with tappable bases.
 *
 * Props:
 *   bases        { first, second, third } — each null or { playerName, playerNumber }
 *   onBaseClick  (baseName: 'first'|'second'|'third') => void — fires on tap
 *   compact      boolean — smaller version
 */
export default function BaseDiamond({ bases = {}, compact = false, onBaseClick }) {
  const f = bases?.first  ?? null
  const s = bases?.second ?? null
  const t = bases?.third  ?? null

  const size    = compact ? 130 : 200
  const center  = size / 2
  const bSize   = compact ? 10 : 14   // visual base square half-size
  const hitR    = compact ? 16 : 22   // invisible tap-target radius

  const home   = { x: center,    y: size - 16 }
  const first  = { x: size - 20, y: center }
  const second = { x: center,    y: 16 }
  const third  = { x: 20,        y: center }

  const coords = { first, second, third }
  const runners = { first: f, second: s, third: t }
  const labels  = { first: '1B', second: '2B', third: '3B' }
  const sides   = { first: 'right', second: 'right', third: 'left' }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      aria-label="Baseball diamond"
      style={{ overflow: 'visible' }}
    >
      {/* Baselines */}
      <polyline
        points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y} ${home.x},${home.y}`}
        fill="none"
        stroke="#374151"
        strokeWidth={compact ? 1.5 : 2}
        strokeLinejoin="round"
      />

      {/* Home plate */}
      <polygon
        points={`
          ${home.x},${home.y - bSize}
          ${home.x + bSize},${home.y - 3}
          ${home.x + bSize - 3},${home.y + 4}
          ${home.x - bSize + 3},${home.y + 4}
          ${home.x - bSize},${home.y - 3}
        `}
        fill="#1f2937"
        stroke="#4b5563"
        strokeWidth="1.5"
      />

      {/* Bases (1B, 2B, 3B) */}
      {['first', 'second', 'third'].map((key) => {
        const pos      = coords[key]
        const runner   = runners[key]
        const occupied = !!runner
        const side     = sides[key]
        const interactive = !!onBaseClick
        const nameLabel = runner
          ? (runner.playerNumber ? `#${runner.playerNumber}` : runner.playerName?.split(' ')[0])
          : null

        return (
          <g
            key={key}
            onClick={interactive ? () => onBaseClick(key) : undefined}
            style={interactive ? { cursor: 'pointer' } : undefined}
          >
            {/* Large transparent tap target */}
            {interactive && (
              <circle cx={pos.x} cy={pos.y} r={hitR} fill="transparent" />
            )}

            {/* Glow ring on occupied interactive bases */}
            {occupied && interactive && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={bSize + 5}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.5"
                opacity="0.4"
              />
            )}

            {/* Base square */}
            <rect
              x={pos.x - bSize / 2}
              y={pos.y - bSize / 2}
              width={bSize}
              height={bSize}
              transform={`rotate(45, ${pos.x}, ${pos.y})`}
              fill={occupied ? '#f59e0b' : '#374151'}
              stroke={occupied ? '#fbbf24' : '#4b5563'}
              strokeWidth="1.5"
              rx="1"
            />

            {/* Runner label */}
            {nameLabel && (
              <text
                x={side === 'right' ? pos.x + bSize + 5 : pos.x - bSize - 5}
                y={pos.y + 4}
                textAnchor={side === 'right' ? 'start' : 'end'}
                fontSize={compact ? 8 : 10}
                fill="#fbbf24"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                {nameLabel}
              </text>
            )}

            {/* Tap hint on occupied interactive bases (small arrow) */}
            {occupied && interactive && !compact && (
              <text
                x={pos.x}
                y={pos.y - bSize - 8}
                textAnchor="middle"
                fontSize="8"
                fill="#f59e0b"
                opacity="0.7"
                fontFamily="system-ui, sans-serif"
              >
                tap
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
