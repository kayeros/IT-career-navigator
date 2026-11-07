import type { Block } from "../../api/types";

/**
 * Раскладка карты профессии, как в прототипе (roadmapLayout в app.js):
 * блоки — по центральной оси, темы блока — половина слева, половина справа.
 */
export const RM = {
  W: 960,
  MW: 230,
  MH: 50,
  SW: 210,
  SH: 40,
  SG: 10,
  PAD: 40,
  ROW_GAP: 34,
} as const;

export type RmNode = {
  key: string;
  kind: "main" | "sub";
  blockId: number;
  topicId?: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RmLine = { key: string; d: string; spine: boolean };

export function roadmapLayout(blocks: Block[]) {
  const { W, MW, MH, SW, SH, SG, PAD, ROW_GAP } = RM;
  const MX = (W - MW) / 2;
  const SX_L = 24;
  const SX_R = W - 24 - SW;
  const sideH = (k: number) => (k ? k * SH + (k - 1) * SG : 0);

  const nodes: RmNode[] = [];
  const lines: RmLine[] = [];
  let y = PAD;
  let prev: { y: number } | null = null;

  for (const b of blocks) {
    const half = Math.ceil(b.topics.length / 2);
    const sides = [
      { arr: b.topics.slice(0, half), sx: SX_L, left: true },
      { arr: b.topics.slice(half), sx: SX_R, left: false },
    ];
    const rowH = Math.max(MH, sideH(sides[0].arr.length), sideH(sides[1].arr.length));
    const my = y + (rowH - MH) / 2;

    nodes.push({ key: `b${b.id}`, kind: "main", blockId: b.id, x: MX, y: my, w: MW, h: MH });
    if (prev)
      lines.push({ key: `s${b.id}`, d: `M${W / 2} ${prev.y + MH} L${W / 2} ${my}`, spine: true });
    prev = { y: my };

    for (const { arr, sx, left } of sides) {
      let sy = y + (rowH - sideH(arr.length)) / 2;
      for (const t of arr) {
        nodes.push({
          key: `b${b.id}t${t.id}`,
          kind: "sub",
          blockId: b.id,
          topicId: t.id,
          x: sx,
          y: sy,
          w: SW,
          h: SH,
        });
        const x1 = left ? MX : MX + MW;
        const y1 = my + MH / 2;
        const x2 = left ? sx + SW : sx;
        const y2 = sy + SH / 2;
        const cx = (x1 + x2) / 2;
        lines.push({
          key: `l${b.id}-${t.id}`,
          d: `M${x1} ${y1} C${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`,
          spine: false,
        });
        sy += SH + SG;
      }
    }
    y += rowH + ROW_GAP;
  }
  return { W, H: Math.max(y + PAD - ROW_GAP, PAD * 2), nodes, lines };
}
