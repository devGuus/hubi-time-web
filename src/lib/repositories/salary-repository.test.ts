import { describe, expect, it } from "vitest";

import { DEFAULT_WEEKLY_HOURS } from "@/lib/constants";
import { monthlyHoursDivisorFor } from "./salary-repository";

describe("monthlyHoursDivisorFor", () => {
  it("44h semanais (padrao CLT) resulta no divisor 220", () => {
    const weeklyHours = { ...DEFAULT_WEEKLY_HOURS, segunda: 8.8, terca: 8.8, quarta: 8.8, quinta: 8.8, sexta: 8.8 };
    expect(monthlyHoursDivisorFor(weeklyHours)).toBe(220);
  });

  it("40h semanais resulta no divisor 200", () => {
    const weeklyHours = { ...DEFAULT_WEEKLY_HOURS, segunda: 8, terca: 8, quarta: 8, quinta: 8, sexta: 8 };
    expect(monthlyHoursDivisorFor(weeklyHours)).toBe(200);
  });

  it("36h semanais resulta no divisor 180", () => {
    const weeklyHours = { ...DEFAULT_WEEKLY_HOURS, segunda: 7.2, terca: 7.2, quarta: 7.2, quinta: 7.2, sexta: 7.2 };
    expect(monthlyHoursDivisorFor(weeklyHours)).toBe(180);
  });
});
