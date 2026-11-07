import {
  formatDate,
  formatMonth,
  formatPercent,
  formatShare,
  isSafeUrl,
  plural,
  safeNext,
} from "./format";

describe("format", () => {
  it("даты по-русски", () => {
    expect(formatDate("2026-11-05T19:05:02Z")).toMatch(/^[56] ноября 2026$/);
    expect(formatDate("2026-11-01")).toBe("1 ноября 2026");
    expect(formatMonth("2026-11-01")).toBe("ноябрь 2026");
  });

  it("проценты и доли", () => {
    expect(formatPercent(18.2)).toBe("18,2 %");
    expect(formatPercent(0)).toBe("0 %");
    expect(formatShare(0.6667)).toBe("67%");
  });

  it("склонение", () => {
    expect(plural(1, ["тема", "темы", "тем"])).toBe("тема");
    expect(plural(3, ["тема", "темы", "тем"])).toBe("темы");
    expect(plural(11, ["тема", "темы", "тем"])).toBe("тем");
    expect(plural(21, ["тема", "темы", "тем"])).toBe("тема");
  });

  it("безопасные ссылки", () => {
    expect(isSafeUrl("https://glossary.istqb.org/")).toBe(true);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(safeNext("/professions/qa-manual")).toBe("/professions/qa-manual");
    expect(safeNext("//evil.example")).toBe("/professions");
    expect(safeNext("https://evil.example")).toBe("/professions");
    expect(safeNext(null)).toBe("/professions");
  });
});
