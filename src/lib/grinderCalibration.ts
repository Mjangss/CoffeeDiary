import { GRINDER_RANGE } from "../constants";

export type CalibrationSource = "user" | "estimated" | "default" | "missing";
export type CalibrationResult = { um: number; source: CalibrationSource } | null;
type Point = { click: number; um: number };
type Range = { min: number; max: number; step: number };

const kUltraData: Point[] = [
  { click: 4, um: 650 }, { click: 4.5, um: 700 }, { click: 5, um: 750 }, { click: 5.5, um: 800 }, { click: 6, um: 850 }, { click: 6.5, um: 875 }, { click: 7, um: 900 }, { click: 7.5, um: 940 }, { click: 8, um: 980 }, { click: 8.5, um: 1040 }, { click: 9, um: 1080 }, { click: 9.5, um: 1150 }, { click: 10, um: 1220 }, { click: 10.5, um: 1290 }, { click: 11, um: 1360 }, { click: 11.5, um: 1425 }, { click: 12, um: 1490 }, { click: 12.5, um: 1550 }, { click: 13, um: 1610 },
];
const nitroBladeData: Point[] = [
  { click: 20, um: 965 }, { click: 21, um: 980 }, { click: 22, um: 995 }, { click: 23, um: 1022 }, { click: 24, um: 1049 }, { click: 25, um: 1061 }, { click: 26, um: 1072 }, { click: 27, um: 1089 }, { click: 28, um: 1105 }, { click: 29, um: 1123 }, { click: 30, um: 1141 }, { click: 31, um: 1160 }, { click: 32, um: 1178 }, { click: 33, um: 1196 }, { click: 34, um: 1213 }, { click: 35, um: 1231 }, { click: 36, um: 1249 }, { click: 37, um: 1266 }, { click: 38, um: 1284 }, { click: 39, um: 1302 }, { click: 40, um: 1319 }, { click: 41, um: 1337 }, { click: 42, um: 1354 }, { click: 43, um: 1372 }, { click: 44, um: 1390 }, { click: 45, um: 1407 }, { click: 46, um: 1425 }, { click: 47, um: 1443 }, { click: 48, um: 1460 }, { click: 49, um: 1478 }, { click: 50, um: 1495 },
];
const hammerHeadData: Point[] = [
  { click: 20, um: 935 }, { click: 21, um: 964 }, { click: 22, um: 992 }, { click: 23, um: 1015 }, { click: 24, um: 1037 }, { click: 25, um: 1056 }, { click: 26, um: 1075 }, { click: 27, um: 1108 }, { click: 28, um: 1140 }, { click: 29, um: 1161 }, { click: 30, um: 1182 }, { click: 31, um: 1207 }, { click: 32, um: 1232 }, { click: 33, um: 1256 }, { click: 34, um: 1281 }, { click: 35, um: 1305 }, { click: 36, um: 1330 }, { click: 37, um: 1354 }, { click: 38, um: 1378 }, { click: 39, um: 1403 }, { click: 40, um: 1427 }, { click: 41, um: 1452 }, { click: 42, um: 1476 }, { click: 43, um: 1501 }, { click: 44, um: 1525 }, { click: 45, um: 1550 }, { click: 46, um: 1574 }, { click: 47, um: 1599 }, { click: 48, um: 1623 }, { click: 49, um: 1648 }, { click: 50, um: 1672 },
];
const tigerSharkData: Point[] = [
  { click: 20, um: 957 }, { click: 21, um: 970 }, { click: 22, um: 980 }, { click: 23, um: 992 }, { click: 24, um: 1003 }, { click: 25, um: 1015 }, { click: 26, um: 1026 }, { click: 27, um: 1061 }, { click: 28, um: 1096 }, { click: 29, um: 1119 }, { click: 30, um: 1141 }, { click: 31, um: 1170 }, { click: 32, um: 1199 }, { click: 33, um: 1227 }, { click: 34, um: 1256 }, { click: 35, um: 1285 }, { click: 36, um: 1314 }, { click: 37, um: 1343 }, { click: 38, um: 1371 }, { click: 39, um: 1400 }, { click: 40, um: 1429 }, { click: 41, um: 1458 }, { click: 42, um: 1487 }, { click: 43, um: 1515 }, { click: 44, um: 1544 }, { click: 45, um: 1573 }, { click: 46, um: 1602 }, { click: 47, um: 1631 }, { click: 48, um: 1659 }, { click: 49, um: 1688 }, { click: 50, um: 1717 },
];

const tableData: Record<string, Point[]> = { "K-Ultra": kUltraData, "Nitro Blade": nitroBladeData, HammerHead: hammerHeadData, "Tiger Shark": tigerSharkData };
const keyFor = (click: number) => String(Number(click.toFixed(6)));

const interpolate = (click: number, points: Point[]) => {
  const sorted = [...points].sort((a, b) => a.click - b.click);
  if (sorted.length < 2) return null;
  const upper = sorted.findIndex(point => point.click >= click);
  const [left, right] = upper <= 0 ? [sorted[0], sorted[1]] : upper === -1 ? [sorted.at(-2)!, sorted.at(-1)!] : [sorted[upper - 1], sorted[upper]];
  return left.um + ((right.um - left.um) * (click - left.click)) / (right.click - left.click);
};

const inverse = (um: number, points: Point[]) => {
  const sorted = [...points].sort((a, b) => a.click - b.click);
  if (sorted.length < 2 || sorted.some((point, index) => index && point.um <= sorted[index - 1].um)) return null;
  const upper = sorted.findIndex(point => point.um >= um);
  const [left, right] = upper <= 0 ? [sorted[0], sorted[1]] : upper === -1 ? [sorted.at(-2)!, sorted.at(-1)!] : [sorted[upper - 1], sorted[upper]];
  return left.click + ((right.click - left.click) * (um - left.um)) / (right.um - left.um);
};

const defaultMicrons = (grinder: string, click: number) => {
  if (grinder === "Millab M01") return 72.5 + click * 125;
  if (grinder === "EK-43") return 260 + click * 62.5;
  return tableData[grinder] ? interpolate(click, tableData[grinder]) : null;
};

const directPoints = (calibrations: Record<string, Record<string, number>>, grinder: string): Point[] =>
  Object.entries(calibrations[grinder] ?? {}).map(([click, um]) => ({ click: Number(click), um })).filter(point => Number.isFinite(point.click) && Number.isFinite(point.um) && point.um > 0);

export const clickValues = (range: Range) => {
  const count = Math.floor((range.max - range.min) / range.step + 1e-7);
  return Array.from({ length: count + 1 }, (_, index) => Number((range.min + index * range.step).toFixed(6)));
};

export const micronsForClick = (grinder: string, click: number, calibrations: Record<string, Record<string, number>>): CalibrationResult => {
  const points = directPoints(calibrations, grinder);
  const direct = points.find(point => keyFor(point.click) === keyFor(click));
  if (direct) return { um: direct.um, source: "user" };
  if (points.length >= 2) return { um: interpolate(click, points)!, source: "estimated" };
  const um = defaultMicrons(grinder, click);
  return um === null ? null : { um, source: "default" };
};

export const clickForMicrons = (grinder: string, um: number, calibrations: Record<string, Record<string, number>>) => {
  const points = directPoints(calibrations, grinder);
  if (points.length >= 2) return inverse(um, points);
  if (grinder === "Millab M01") return (um - 72.5) / 125;
  if (grinder === "EK-43") return (um - 260) / 62.5;
  return tableData[grinder] ? inverse(um, tableData[grinder]) : null;
};

export const hasCalibration = (grinder: string, calibrations: Record<string, Record<string, number>>) =>
  directPoints(calibrations, grinder).length >= 2 || Boolean(GRINDER_RANGE[grinder] && defaultMicrons(grinder, GRINDER_RANGE[grinder].min) !== null);

export const calibrationKey = keyFor;
