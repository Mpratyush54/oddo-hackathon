export function ProductArt({ type, color }: { type: string; color: string }) {
  return (
    <div className={`product-art product-${color}`}>
      <svg viewBox="0 0 300 245" aria-label={`Skyline ${type}`} role="img">
        <ellipse cx="150" cy="216" rx="83" ry="9" fill="currentColor" opacity=".06" />
        {type === 'Tote bag' ? (
          <>
            <path
              d="M102 66c0-65 96-65 96 0"
              fill="none"
              stroke="var(--product-fabric)"
              strokeWidth="10"
            />
            <path d="M76 64h148l-11 140H87Z" fill="var(--product-fabric)" />
            <path d="M85 75h130M99 78v114m103-114v114" stroke="var(--product-seam)" fill="none" />
          </>
        ) : (
          <>
            <path
              d={
                type === 'Hoodie'
                  ? 'M119 48c-10-49 74-49 62 0l33 10 45 66-36 21-27-36 9 94H96l8-94-27 36-36-21 45-66Z'
                  : 'M119 44l-34 9-45 52 31 28 34-29-9 99h109l-10-99 34 29 31-28-45-52-34-9c-4 29-58 29-62 0Z'
              }
              fill="var(--product-fabric)"
            />
            <path d="M98 190h106M99 83l7 22m95-22-7 22" stroke="var(--product-seam)" fill="none" />
            {type === 'Hoodie' && (
              <>
                <path
                  d="m119 48 31 13 31-13M146 61v26m10-26v26m-34 70-10 23h76l-10-23"
                  stroke="var(--product-seam)"
                  fill="none"
                />
                <path d="m124 46 26 10 26-10" stroke="var(--product-seam)" fill="none" />
              </>
            )}
          </>
        )}
        <g fill="var(--product-print)" textAnchor="middle">
          <text x="150" y="123" fontSize="20" fontFamily="Georgia, serif" fontWeight="bold">
            skyline.
          </text>
          <text x="150" y="138" fontSize="5.5" letterSpacing="2.4">
            BETTER TOGETHER
          </text>
        </g>
      </svg>
      <span className="product-art-caption">MADE FOR YOUR EVERYDAY.</span>
    </div>
  );
}
