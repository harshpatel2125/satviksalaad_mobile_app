// General wellness habits, not medical advice. Have Divya review any change.
const HABIT_TIPS: readonly string[] = [
  'Eat dinner 2–3 hours before bed. A lighter, earlier dinner sits better overnight.',
  'Start the day with a glass of warm water, before tea or coffee.',
  'Fill half your lunch plate with vegetables or salad.',
  'Eat slowly and keep the phone away during meals.',
  'A 10-minute walk after a meal is the easiest way to add movement to your day.',
  'Keep a water bottle on your desk. You drink more without thinking about it.',
  'Reach for fruit instead of a sweet snack in the afternoon.',
  'Take five slow breaths before you eat.',
  'Take the stairs at least once today.',
  'Sleep and wake at the same time every day, weekends too.',
  'Swap one packaged snack for nuts, sprouts or fruit.',
  'Stand up and stretch for two minutes every hour you sit.',
  'Go easy on salt: packaged food carries more than it seems.',
  'Get 10 to 15 minutes of morning sunlight.',
];

/** The same tip all day, a different one each day. */
export function habitTipOfTheDay(date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return HABIT_TIPS[dayOfYear % HABIT_TIPS.length];
}
