export const JOURNEY_STORAGE_KEY = "sb-onboarding-journey";

export type OnboardingJourney = "solver" | "creator";

export function readOnboardingJourney(): OnboardingJourney | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
  return value === "solver" || value === "creator" ? value : null;
}

export function writeOnboardingJourney(journey: OnboardingJourney): void {
  window.localStorage.setItem(JOURNEY_STORAGE_KEY, journey);
}
