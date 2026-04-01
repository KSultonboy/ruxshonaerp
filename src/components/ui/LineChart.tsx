"use client";

import React, { useMemo, useState, useRef } from "react";
import { moneyUZS } from "@/lib/format";

type Series = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

type Props = {
  labels: string[];
  series: Series[];
  height?: number;
  emptyLabel?: string;
};

type Point = { x: number; y: number };

// Viewbox coordinate space — SVG uses these for path/line math only (no text)
const VW = 160;
const VH = 80;
const LG = 20;  // left gutter (Y-axis label zone)
const RG = 8;   // right gutter
const TG = 8;   // top gutter
const BG = 14;  // bottom gutter (X-axis label zone)
const Y_TICKS = 5;
const SMOOTHING = 0.2;

function safeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function controlPoint(current: Point, previous?: Point, next?: Point, reverse = false) {
  const p = previous ?? current;
  const n = next ?? current;
  const length = Math.hypot(n.x - p.x, n.y - p.y);
  const angle = Math.atan2(n.y - p.y, n.x - p.x) + (reverse ? Math.PI : 0);
  return {
    x: current.x + Math.cos(angle) * length * SMOOTHING,
    y: current.y + Math.sin(angle) * length * SMOOTHING,
  };
}

function buildSmoothPath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((path, point, idx, arr) => {
    if (idx === 0) return `M ${point.x} ${point.y}`;
    const prev = arr[idx - 1];
    const cps = controlPoint(prev, arr[idx - 2], point);
    const cpe = controlPoint(point, prev, arr[idx + 1], true);
    return `${path} C ${cps.x} ${cps.y}, ${cpe.x} ${cpe.y}, ${point.x} ${point.y}`;
  }, "");
}

function niceMax(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction = 1;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

function formatCompactValue(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const format = (num: number, suffix: string) => {
    const rounded = num >= 10 ? num.toFixed(0) : num.toFixed(1);
    return `${sign}${rounded.replace(/\.0$/, "")}${suffix}`;
  };
  if (abs >= 1_000_000_000) return format(abs / 1_000_000_000, "b");
  if (abs >= 1_000_000) return format(abs / 1_000_000, "m");
  if (abs >= 1_000) return format(abs / 1_000, "k");
  return `${sign}${Math.round(abs)}`;
}

function formatXAxisLabel(label: string) {
  const match = label.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}.${match[2]}`;
  return label;
}

function buildTickIndices(length: number) {
  if (length <= 0) return [];
  if (length === 1) return [0];
  let step = 1;
  if (length > 28) step = 7;
  else if (length > 18) step = 5;
  else if (length > 12) step = 4;
  else if (length > 8) step = 2;
  const ticks = new Set([0, length - 1]);
  for (let i = 0; i < length; i += step) ticks.add(i);
  return Array.from(ticks).sort((a, b) => a - b);
}

// Convert SVG coords → % of container (for HTML overlays)
function xPct(svgX: number) { return (svgX / VW) * 100; }
function yPct(svgY: number) { return (svgY / VH) * 100; }

export default function LineChart({ labels, series, height = 260, emptyLabel = "Ma'lumot yo'q" }: Props) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hasData = labels.length > 0 && series.some((s) => s.values.some((v) => Math.abs(v) > 0));
  const chartWidth = VW - LG - RG;
  const chartHeight = VH - TG - BG;
  const span = Math.max(labels.length - 1, 1);

  const yAxis = useMemo(() => {
    if (!hasData) return { scaleMin: 0, scaleMax: 1, ticks: [] as { value: number; y: number }[] };
    const values = series.flatMap((s) => s.values);
    const maxValue = Math.max(0, ...values);
    const scaleMax = niceMax(maxValue * 1.1 || 1);
    const scaleMin = 0;
    const range = scaleMax - scaleMin || 1;
    const step = range / (Y_TICKS - 1);
    const ticks = Array.from({ length: Y_TICKS }, (_, idx) => {
      const value = scaleMax - step * idx;
      const y = TG + (chartHeight / (Y_TICKS - 1)) * idx;
      return { value, y };
    });
    return { scaleMin, scaleMax, ticks };
  }, [chartHeight, hasData, series]);

  const scaleMax = yAxis.scaleMax;
  const scaleRange = scaleMax || 1;
  const baselineY = TG + (scaleMax / scaleRange) * chartHeight;

  const xTickIndices = useMemo(() => buildTickIndices(labels.length), [labels.length]);
  const xTicks = useMemo(() => {
    if (!labels.length) return [];
    return xTickIndices
      .map((idx) => ({
        idx,
        label: formatXAxisLabel(labels[idx] ?? ""),
        x: LG + (idx / span) * chartWidth,
      }))
      .filter((tick) => tick.label);
  }, [chartWidth, labels, span, xTickIndices]);

  const chartSeries = useMemo(() => {
    if (!hasData) return [];
    return series.map((s) => {
      const points = s.values.map((value, idx) => {
        const x = LG + (idx / span) * chartWidth;
        const y = TG + ((scaleMax - value) / scaleRange) * chartHeight;
        return { x, y };
      });
      const path = buildSmoothPath(points);
      const areaPath =
        points.length > 1 ? `${path} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z` : "";
      return { ...s, points, path, areaPath, gradientId: `line-fill-${safeId(s.id)}` };
    });
  }, [baselineY, chartHeight, chartWidth, hasData, scaleMax, scaleRange, series, span]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!svgRef.current || !hasData) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    const chartX = x - LG;
    const idx = Math.round((chartX / chartWidth) * span);
    if (idx >= 0 && idx < labels.length) setHoverIdx(idx);
    else setHoverIdx(null);
  };

  const handleMouseLeave = () => setHoverIdx(null);

  if (!hasData) {
    return (
      <div style={{ height }} className="w-full flex items-center justify-center rounded-3xl border border-cream-200 bg-cream-50/50 text-sm text-cocoa-400">
        {emptyLabel}
      </div>
    );
  }

  const hoverX = hoverIdx !== null ? LG + (hoverIdx / span) * chartWidth : null;

  return (
    <div
      style={{ height }}
      className="group relative w-full overflow-hidden rounded-3xl border border-cream-100 bg-white shadow-sm transition hover:shadow-md"
    >
      {/* ── SVG: paths, grid lines, hover guide (no text) ── */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {chartSeries.map((s) => (
            <linearGradient key={s.id} id={s.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Grid lines */}
        <g className="opacity-40">
          {yAxis.ticks.map((tick, idx) => (
            <line
              key={idx}
              x1={LG} x2={VW - RG}
              y1={tick.y} y2={tick.y}
              stroke="#E5E7EB"
              strokeWidth="0.5"
              strokeDasharray={idx === yAxis.ticks.length - 1 ? "0" : "1 1"}
            />
          ))}
        </g>

        {/* Series */}
        {chartSeries.map((s) => (
          <g key={s.id}>
            {s.areaPath && <path d={s.areaPath} fill={`url(#${s.gradientId})`} />}
            {s.path && (
              <path d={s.path} fill="none" stroke={s.color} strokeWidth="1.2"
                strokeLinecap="round" strokeLinejoin="round" />
            )}
            {hoverIdx !== null && s.points[hoverIdx] && (
              <circle cx={s.points[hoverIdx].x} cy={s.points[hoverIdx].y}
                r="1.8" fill="white" stroke={s.color} strokeWidth="0.8" />
            )}
          </g>
        ))}

        {/* Hover guide line */}
        {hoverX !== null && (
          <line x1={hoverX} x2={hoverX} y1={TG} y2={baselineY}
            stroke="#D1D5DB" strokeWidth="0.5" strokeDasharray="2 2" />
        )}
      </svg>

      {/* ── Y-axis labels (HTML, no stretch) ── */}
      {yAxis.ticks.map((tick, idx) => (
        <div
          key={idx}
          className="pointer-events-none absolute text-[10px] font-medium text-slate-400 leading-none"
          style={{
            top: `${yPct(tick.y)}%`,
            left: `${xPct(0)}%`,
            width: `${xPct(LG - 1)}%`,
            transform: "translateY(-50%)",
            textAlign: "right",
          }}
        >
          {formatCompactValue(tick.value)}
        </div>
      ))}

      {/* ── X-axis labels (HTML, no stretch) ── */}
      {xTicks.map((tick) => (
        <div
          key={tick.idx}
          className="pointer-events-none absolute text-[10px] font-medium text-slate-400 leading-none"
          style={{
            left: `${xPct(tick.x)}%`,
            bottom: `${100 - yPct(VH)}%`,
            transform: "translateX(-50%)",
          }}
        >
          {tick.label}
        </div>
      ))}

      {/* ── Tooltip (HTML) ── */}
      {hoverIdx !== null && hoverX !== null && (
        <div
          className="pointer-events-none absolute z-50 min-w-[140px] -translate-x-1/2 rounded-xl border border-cream-200 bg-white p-2 shadow-xl"
          style={{
            left: `${xPct(hoverX)}%`,
            top: "8%",
          }}
        >
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cocoa-400">
            {labels[hoverIdx]}
          </div>
          <div className="space-y-1">
            {series.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] font-medium text-cocoa-700">{s.label}</span>
                </div>
                <div className="text-[11px] font-bold text-cocoa-900">
                  {moneyUZS(s.values[hoverIdx])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
