import { describe, expect, it } from "vitest";
import { axlePlan, costPerKm, shortKm, tyreHealth, tyrePositions } from "./tyres";

describe("tyre configuration helpers", () => {
  it.each([[4, 4], [6, 6], [8, 8], [12, 12], [14, 14], [16, 16]])("generates %i positions", (wheels, expected) => {
    expect(tyrePositions(wheels)).toHaveLength(expected);
  });

  it("keeps TMS special axle layouts", () => {
    expect(axlePlan(14)).toEqual({ steer: 1, rear: 3 });
    expect(axlePlan(16)).toEqual({ steer: 2, rear: 3 });
  });

  it("classifies health at exact boundaries", () => {
    expect(tyreHealth(49999)).toBe("Good");
    expect(tyreHealth(50000)).toBe("Moderate");
    expect(tyreHealth(80000)).toBe("Moderate");
    expect(tyreHealth(80001)).toBe("Replace");
  });

  it("formats kilometres and cost safely", () => {
    expect(shortKm(132400)).toBe("1.3L");
    expect(shortKm(1500)).toBe("1.5K");
    expect(costPerKm(25000, 0)).toBe(0);
    expect(costPerKm(25000, 1000)).toBe(25);
  });
});
