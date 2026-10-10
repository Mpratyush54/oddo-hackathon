import { useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { Icon } from '../../../shared/ui/Icon';
import '../styles/garment-preview.css';

const fabrics = [
  { id: 'teal', name: 'Campus teal', hex: '#235d55', ink: '#f4eed9' },
  { id: 'cream', name: 'Warm cream', hex: '#e7decb', ink: '#294d43' },
  { id: 'green', name: 'Forest green', hex: '#536c4b', ink: '#faf4dd' },
  { id: 'ink', name: 'Midnight ink', hex: '#303c48', ink: '#f7efde' },
];

function GarmentFace({ kind, back, id }: { kind: string; back: boolean; id: string }) {
  const hoodie = kind.toLowerCase().includes('hood');
  const tote = kind.toLowerCase().includes('tote') || kind.toLowerCase().includes('bag');
  const silhouette = tote
    ? 'M94 115H286L275 341H105Z'
    : hoodie
      ? 'M148 97C132 70 136 33 161 24Q190 9 219 24C244 33 248 70 232 97L270 114L337 215L294 242L263 195L269 342H111L117 195L86 242L43 215L110 114Z'
      : 'M151 79L112 94L44 174L89 209L120 171L109 342H271L260 171L291 209L336 174L268 94L229 79Q222 113 190 113Q158 113 151 79Z';
  return (
    <svg className="garment-svg" viewBox="0 0 380 390" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fabric`} x1="0" y1="0" x2="1" y2=".35">
          <stop offset="0" style={{ stopColor: 'var(--garment-fabric)' }} />
          <stop offset=".45" style={{ stopColor: 'var(--garment-fabric)' }} />
          <stop offset="1" style={{ stopColor: 'var(--garment-fabric)' }} />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".2" />
          <stop offset=".2" stopColor="#fff" stopOpacity=".06" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".2" />
          <stop offset=".78" stopColor="#000" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <pattern id={`${id}-knit`} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 1L2 3L4 1" fill="none" stroke="#fff" strokeWidth=".4" opacity=".18" />
        </pattern>
        <clipPath id={`${id}-clip`}>
          <path d={silhouette} />
        </clipPath>
      </defs>
      {tote && (
        <>
          <path
            d="M130 121V81C130 7 250 7 250 81V121"
            fill="none"
            stroke="var(--garment-fabric)"
            strokeWidth="14"
          />
          <path
            d="M133 115V81C133 12 247 12 247 81V115"
            fill="none"
            stroke="#fff"
            opacity=".2"
            strokeWidth="2"
          />
        </>
      )}
      <path
        d={silhouette}
        fill={`url(#${id}-fabric)`}
        stroke="#000"
        strokeOpacity=".11"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d={silhouette} fill={`url(#${id}-shade)`} />
      <path d={silhouette} fill={`url(#${id}-knit)`} />
      <g
        clipPath={`url(#${id}-clip)`}
        fill="none"
        stroke="#000"
        strokeOpacity=".16"
        strokeWidth="1.5"
      >
        {tote ? (
          <>
            <path d="M106 125H274M118 128L125 326M262 128L255 326M112 329H277" />
            <path d="M136 109V135M244 109V135" strokeWidth="4" />
          </>
        ) : (
          <>
            <path d="M115 330H267M113 336H268M118 123L131 166M262 123L249 166M79 220L91 212M288 213L302 223" />
            <path d="M136 186L141 291M248 181L243 291" strokeOpacity=".06" strokeWidth="8" />
          </>
        )}
      </g>
      {hoodie && (
        <>
          {back ? (
            <path
              d="M150 40Q190 13 230 40L225 113Q190 139 155 113Z"
              fill="#000"
              fillOpacity=".12"
              stroke="#fff"
              strokeOpacity=".1"
            />
          ) : (
            <>
              <path d="M151 89Q190 117 229 89L215 111Q190 123 165 111Z" fill="#000" opacity=".23" />
              <path
                d="M161 35Q143 58 159 89M219 35Q237 58 221 89M174 111V160M206 111V160"
                fill="none"
                stroke="var(--garment-ink)"
                strokeOpacity=".45"
                strokeWidth="2"
              />
              <path
                d="M153 263L143 299H237L227 263"
                fill="#000"
                fillOpacity=".06"
                stroke="#fff"
                strokeOpacity=".16"
              />
              <path d="M148 295H231" fill="none" stroke="#000" strokeOpacity=".13" />
            </>
          )}
        </>
      )}
      {!hoodie && !tote && (
        <path
          d="M151 79Q158 113 190 113Q222 113 229 79"
          fill="none"
          stroke="#000"
          strokeOpacity=".24"
          strokeWidth="6"
        />
      )}
      <g fill="var(--garment-ink)" textAnchor="middle">
        {back ? (
          <>
            <text
              x="190"
              y={hoodie ? 185 : 189}
              fontFamily="Georgia,serif"
              fontStyle="italic"
              fontSize="20"
            >
              better
            </text>
            <text
              x="190"
              y={hoodie ? 213 : 218}
              fontFamily="Georgia,serif"
              fontWeight="bold"
              fontSize="28"
            >
              together.
            </text>
            <path d="M162 241H218" stroke="var(--garment-ink)" strokeWidth="1" opacity=".6" />
            <text x="190" y="260" fontFamily="sans-serif" fontSize="6.5" letterSpacing="2">
              SKYLINE ASSOCIATION
            </text>
            <text x="190" y="273" fontFamily="sans-serif" fontSize="5.5" letterSpacing="2">
              EST. 2020 · CAMPUS COLLECTION
            </text>
          </>
        ) : (
          <>
            <text
              x="190"
              y={hoodie ? 209 : 207}
              fontFamily="Georgia,serif"
              fontSize="32"
              fontWeight="bold"
            >
              skyline.
            </text>
            <text
              x="190"
              y={hoodie ? 226 : 225}
              fontFamily="sans-serif"
              fontSize="6.5"
              letterSpacing="3"
            >
              BELONG HERE. BUILD TOGETHER.
            </text>
          </>
        )}
      </g>
      <path
        d={tote ? 'M117 340H133V328H117Z' : 'M259 338H274V326H259Z'}
        fill="var(--garment-ink)"
        opacity=".8"
      />
    </svg>
  );
}

export default function GarmentPreview({
  kind,
  color,
  onColorChange,
}: {
  kind: string;
  color: string;
  onColorChange: (color: string) => void;
}) {
  const id = useId().replace(/:/g, '');
  const [rotation, setRotation] = useState(-18),
    [tilt, setTilt] = useState(-5),
    [dragging, setDragging] = useState(false);
  const drag = useRef<{
    x: number;
    y: number;
    rotation: number;
    tilt: number;
    pointer: number;
  } | null>(null);
  const fabric = fabrics.find((f) => f.id === color) || fabrics[0];
  const angle = Math.round(((rotation % 360) + 360) % 360);
  const frontVisible = angle < 90 || angle > 270;
  const style = { '--garment-fabric': fabric.hex, '--garment-ink': fabric.ink } as CSSProperties;
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, rotation, tilt, pointer: event.pointerId };
    setDragging(true);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    setRotation(drag.current.rotation + (event.clientX - drag.current.x) * 0.7);
    setTilt(
      Math.max(-18, Math.min(18, drag.current.tilt - (event.clientY - drag.current.y) * 0.15)),
    );
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setRotation(
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? 360
          : rotation + (event.key === 'ArrowLeft' ? -15 : 15),
    );
  };
  return (
    <section className="garment-preview" style={style} aria-label={`Interactive ${kind} preview`}>
      <div className="garment-preview-top">
        <span>
          <Icon name="Shirt" size={16} />
          THE CAMPUS COLLECTION
        </span>
        <span className="garment-preview-angle">{angle}°</span>
      </div>
      <div
        className={`garment-stage ${dragging ? 'is-dragging' : ''}`}
        role="slider"
        aria-label="Garment rotation"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={angle}
        aria-valuetext={`${angle} degrees, ${frontVisible ? 'front' : 'back'} view`}
        aria-describedby={`${id}-instructions`}
        tabIndex={0}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onKeyDown={keyDown}
      >
        <span className="garment-stage-word" aria-hidden="true">
          skyline.
        </span>
        <div className="garment-floor" />
        <div
          className="garment-model"
          style={{ transform: `rotateX(${tilt}deg) rotateY(${rotation}deg)` }}
        >
          <div className="garment-face garment-front">
            <GarmentFace kind={kind} back={false} id={`${id}-front`} />
          </div>
          <div className="garment-face garment-back">
            <GarmentFace kind={kind} back id={`${id}-back`} />
          </div>
        </div>
        <span className="garment-drag-hint">
          <Icon name="ChevronsUpDown" size={14} />
          {dragging ? 'Keep turning. Find your angle.' : 'Drag to rotate · touch friendly'}
        </span>
      </div>
      <div className="garment-view-controls">
        <div>
          <button
            type="button"
            aria-pressed={frontVisible}
            onClick={() => {
              setRotation(0);
              setTilt(-5);
            }}
          >
            Front
          </button>
          <button
            type="button"
            aria-pressed={!frontVisible}
            onClick={() => {
              setRotation(180);
              setTilt(-5);
            }}
          >
            Back
          </button>
        </div>
        <span>Designed to belong.</span>
      </div>
      <div className="garment-color-controls">
        <div>
          <strong>{fabric.name}</strong>
          <small>Explore the collection colors</small>
        </div>
        <div className="garment-swatches">
          {fabrics.map((f) => (
            <button
              key={f.id}
              type="button"
              style={{ background: f.hex }}
              className={color === f.id ? 'selected' : ''}
              aria-label={`Preview ${f.name}`}
              aria-pressed={color === f.id}
              onClick={() => onColorChange(f.id)}
            >
              {color === f.id && <Icon name="Check" size={14} />}
            </button>
          ))}
        </div>
      </div>
      <p className="garment-preview-note" id={`${id}-instructions`}>
        Illustrative garment preview. Use left/right arrow keys to rotate. Colors and print
        placement are a design guide; this is not a fit simulation.
      </p>
    </section>
  );
}
