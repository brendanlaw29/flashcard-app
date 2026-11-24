/** testUtils.js — helpers shared by the unit tests. */

/** Small seeded random generator (Park–Miller) so tests are repeatable. */
export function seeded(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
