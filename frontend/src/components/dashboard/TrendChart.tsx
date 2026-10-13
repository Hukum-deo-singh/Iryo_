import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { Card } from '@/components/ui/Card';
import { useStyles, useTheme } from '@/context/PrefsContext';
import { SPACING, type Theme } from '@/theme/tokens';
import { formatDateTime, formatShortDate } from '@/utils/format';

export interface ChartPoint {
  t: number;
  v: number;
}

interface Props {
  title: string;
  unit: string;
  decimals: number;
  points: ChartPoint[];
  /** Highest value the axis may show, for example 100 for percentages. */
  cap?: number;
}

const HEIGHT = 208;
const PAD_L = 42;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Axis ticks that land on round numbers, never closer together than one display unit. */
export function buildAxis(min: number, max: number, decimals: number, cap?: number) {
  const minStep = 10 ** -decimals;
  let lo = min;
  let hi = max;
  if (hi - lo < minStep * 2) {
    lo -= minStep * 1.5;
    hi += minStep * 1.5;
  }
  const step = Math.max(niceStep((hi - lo) / 3), minStep);
  const start = Math.floor(lo / step) * step;
  let end = Math.ceil(hi / step) * step;
  if (cap !== undefined) end = Math.min(end, cap);
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1000; v += step) ticks.push(Number(v.toFixed(6)));
  if (ticks[ticks.length - 1] < hi - 1e-9) ticks.push(end);
  return { ticks, lo: ticks[0], hi: ticks[ticks.length - 1] };
}

function timeLabel(t: number, spanMs: number): string {
  if (spanMs < 36 * 3600_000) {
    return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return formatShortDate(t);
}

function TrendChartBase({ title, unit, decimals, points, cap }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const sorted = useMemo(() => [...points].sort((a, b) => a.t - b.t), [points]);
  const geometry = useMemo(() => {
    if (sorted.length === 0 || width === 0) return null;
    const values = sorted.map((p) => p.v);
    const axis = buildAxis(Math.min(...values), Math.max(...values), decimals, cap);
    const t0 = sorted[0].t;
    const t1 = sorted[sorted.length - 1].t;
    const innerW = width - PAD_L - PAD_R;
    const innerH = HEIGHT - PAD_T - PAD_B;
    const x = (t: number) => (t1 === t0 ? PAD_L + innerW / 2 : PAD_L + ((t - t0) / (t1 - t0)) * innerW);
    const y = (v: number) => PAD_T + (1 - (v - axis.lo) / (axis.hi - axis.lo || 1)) * innerH;
    const xy = sorted.map((p) => ({ x: x(p.t), y: y(p.v) }));
    const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const base = PAD_T + innerH;
    const area = `${line} L${xy[xy.length - 1].x.toFixed(1)} ${base} L${xy[0].x.toFixed(1)} ${base} Z`;
    return { axis, xy, line, area, y, base, t0, t1 };
  }, [sorted, width, decimals, cap]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const scrub = (e: GestureResponderEvent) => {
    if (!geometry) return;
    const touchX = e.nativeEvent.locationX;
    let best = 0;
    let bestDist = Infinity;
    geometry.xy.forEach((p, i) => {
      const d = Math.abs(p.x - touchX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  };

  const values = sorted.map((p) => p.v);
  const shown = active !== null ? sorted[active] : sorted[sorted.length - 1];
  const span = sorted.length > 1 ? sorted[sorted.length - 1].t - sorted[0].t : 0;
  const summary =
    sorted.length > 0
      ? `${title}: ${sorted.length} readings from ${Math.min(...values).toFixed(decimals)} to ${Math.max(...values).toFixed(decimals)} ${unit}.`
      : `${title}: no readings in this period.`;

  return (
    <Animated.View entering={FadeIn.duration(500)}>
      <Card>
        <View style={s.header}>
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          {shown ? (
            <View style={s.readout}>
              <Text style={s.readoutValue}>
                {shown.v.toFixed(decimals)} <Text style={s.readoutUnit}>{unit}</Text>
              </Text>
              <Text style={s.readoutTime}>{active !== null ? formatDateTime(new Date(shown.t).toISOString()) : 'Latest'}</Text>
            </View>
          ) : null}
        </View>

        {sorted.length === 0 ? (
          <Text style={s.empty}>No readings in this period yet.</Text>
        ) : (
          <View
            accessible
            accessibilityLabel={summary}
            onLayout={onLayout}
            style={s.chart}
            onTouchStart={scrub}
            onTouchMove={scrub}
            onTouchEnd={() => setActive(null)}
            onTouchCancel={() => setActive(null)}
          >
            {geometry ? (
              <Svg width={width} height={HEIGHT} pointerEvents="none">
                <Defs>
                  <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={theme.accent} stopOpacity={0.28} />
                    <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                {geometry.axis.ticks.map((tick) => {
                  const ty = geometry.y(tick);
                  return (
                    <G key={tick}>
                      <Line x1={PAD_L} x2={width - PAD_R} y1={ty} y2={ty} stroke={theme.border} strokeWidth={1} strokeDasharray="4 5" />
                      <SvgText x={PAD_L - 8} y={ty + 4} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                        {tick.toFixed(decimals)}
                      </SvgText>
                    </G>
                  );
                })}
                <Line x1={PAD_L} x2={width - PAD_R} y1={geometry.base} y2={geometry.base} stroke={theme.border} strokeWidth={1.5} />
                {sorted.length > 1 ? (
                  <>
                    <Path d={geometry.area} fill="url(#fill)" />
                    <Path d={geometry.line} stroke={theme.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                  </>
                ) : null}
                {active !== null ? (
                  <Line x1={geometry.xy[active].x} x2={geometry.xy[active].x} y1={PAD_T} y2={geometry.base} stroke={theme.textSecondary} strokeWidth={1} />
                ) : null}
                {(() => {
                  const i = active ?? geometry.xy.length - 1;
                  const p = geometry.xy[i];
                  return (
                    <>
                      <Circle cx={p.x} cy={p.y} r={8} fill={theme.accent} opacity={0.2} />
                      <Circle cx={p.x} cy={p.y} r={4.5} fill={theme.accent} stroke={theme.surfaceHi} strokeWidth={2} />
                    </>
                  );
                })()}
                <SvgText x={PAD_L} y={HEIGHT - 8} fontSize={11} fill={theme.textSecondary} textAnchor="start">
                  {timeLabel(geometry.t0, span)}
                </SvgText>
                {sorted.length > 2 ? (
                  <SvgText x={PAD_L + (width - PAD_L - PAD_R) / 2} y={HEIGHT - 8} fontSize={11} fill={theme.textSecondary} textAnchor="middle">
                    {timeLabel((geometry.t0 + geometry.t1) / 2, span)}
                  </SvgText>
                ) : null}
                {sorted.length > 1 ? (
                  <SvgText x={width - PAD_R} y={HEIGHT - 8} fontSize={11} fill={theme.textSecondary} textAnchor="end">
                    {timeLabel(geometry.t1, span)}
                  </SvgText>
                ) : null}
              </Svg>
            ) : null}
          </View>
        )}
        {sorted.length > 0 ? <Text style={s.hint}>Touch the chart to see a reading</Text> : null}
      </Card>
    </Animated.View>
  );
}

export const TrendChart = memo(TrendChartBase);

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md },
    title: { fontSize: 18, fontWeight: '700', color: t.text, flexShrink: 1 },
    readout: { alignItems: 'flex-end' },
    readoutValue: { fontSize: 18, fontWeight: '700', color: t.text },
    readoutUnit: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    readoutTime: { fontSize: 12, color: t.textSecondary },
    chart: { height: HEIGHT, marginTop: SPACING.md, marginHorizontal: -SPACING.xs },
    empty: { fontSize: 14, color: t.textSecondary, marginTop: SPACING.md },
    hint: { fontSize: 12, color: t.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  });
