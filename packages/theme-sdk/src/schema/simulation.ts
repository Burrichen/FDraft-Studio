import { z } from "zod";
import { IdSchema } from "./primitives.js";

/**
 * Which representative mock dataset the sample component adapters (film
 * grid, event information, etc.) should render with — never a raw data
 * payload the project stores itself, just a closed selector a host resolves
 * against its own fixture set. `"normal"` is an ordinary, populated state;
 * the rest exist so a project can be checked against the edge cases real
 * FDraft data actually produces (nothing to render yet, still loading, a
 * failed fetch, an unusually long author-entered title, and the maximum
 * number of film cards a grid may ever need to lay out).
 */
export const SimulationDataProfileSchema = z.enum(["normal", "empty", "loading", "error", "longTitle", "maxFilmCards"]);
export type SimulationDataProfile = z.infer<typeof SimulationDataProfileSchema>;

/**
 * A saved, named snapshot of every safe mock value the Simulation panel and
 * Preview mode can drive a render with — see `@fdraft/theme-renderer`'s
 * `RenderState`/`HostSettings`, which this shape maps onto directly. Never
 * touches the real Windows clock or FDraft profile/draft/points/watch data;
 * `dateTimeOverrideMs` and every other field here are purely presentational
 * inputs a host substitutes in during preview, not live state.
 */
export const SimulationScenarioSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  eventStatus: z.string().min(1),
  eventActive: z.boolean(),
  eventAvailable: z.boolean(),
  optedIn: z.boolean(),
  draftGenerated: z.boolean(),
  eventCompleted: z.boolean(),
  progressPercent: z.number().min(0).max(100),
  watchedCount: z.number().int().nonnegative(),
  targetCount: z.number().int().nonnegative(),
  performanceTier: z.enum(["low", "medium", "high"]),
  reducedMotion: z.boolean(),
  /** Which page or popup is "current" while this scenario is active — omitted means "whatever the editor already has open." */
  currentPageId: IdSchema.optional(),
  currentPopupId: IdSchema.optional(),
  /** A simulated point in time (epoch ms), fed to `RenderState.dateTimeValues.now` — never the host OS clock. */
  dateTimeOverrideMs: z.number().optional(),
  /** `{{name}}` substitution values for component copy slots, e.g. a mock event title. */
  placeholderValues: z.record(z.string(), z.string()).optional(),
  dataProfile: SimulationDataProfileSchema.default("normal"),
});
export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;
