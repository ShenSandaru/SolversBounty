import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JOURNEY_STORAGE_KEY, readOnboardingJourney, writeOnboardingJourney } from "./journey-preference";

describe("onboarding journey preference", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when nothing is stored", () => {
    expect(readOnboardingJourney()).toBeNull();
  });

  it("stores solver or creator for navigation only", () => {
    writeOnboardingJourney("solver");
    expect(readOnboardingJourney()).toBe("solver");
    writeOnboardingJourney("creator");
    expect(readOnboardingJourney()).toBe("creator");
    expect(store.get(JOURNEY_STORAGE_KEY)).toBe("creator");
  });

  it("ignores unknown stored values", () => {
    store.set(JOURNEY_STORAGE_KEY, "admin");
    expect(readOnboardingJourney()).toBeNull();
  });
});
