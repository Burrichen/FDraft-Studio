import type { AnimationDeclaration, EffectLayer, Layer, MasterPage, Page, Popup, StudioProjectDocument } from "@fdraft/theme-sdk";
import { checkDesignWarnings, type DesignWarning } from "@fdraft/theme-sdk";
import { PERFORMANCE_TIER_CAPS, resolveParticleCount, type PerformanceTierCaps } from "@fdraft/theme-renderer";

/** Assets at or above this size get called out as worth a second look — not a hard limit, just a "you may want to compress this" nudge. */
export const LARGE_ASSET_BYTES = 2 * 1024 * 1024;

export interface EffectLayerSummary {
  layerId: string;
  containerLabel: string;
  name: string;
  kind: EffectLayer["effect"]["kind"];
  intensity: number;
  /** The real, tier-capped particle count this effect would actually draw right now — never a raw, unbounded number. */
  approxParticleCount: number;
}

export interface LargeAssetSummary {
  assetId: string;
  name: string;
  sizeBytes: number;
}

export interface PerformanceReport {
  tier: "low" | "medium" | "high";
  totalLayers: number;
  animatedLayerIds: Set<string>;
  animations: AnimationDeclaration[];
  effectLayers: EffectLayerSummary[];
  effectLayersOverCap: boolean;
  largeAssets: LargeAssetSummary[];
  designWarnings: DesignWarning[];
}

function walkLayers(layers: Layer[], visit: (layer: Layer) => void): void {
  for (const layer of layers) {
    visit(layer);
    if (layer.type === "group") walkLayers(layer.children, visit);
  }
}

/**
 * A structural, approximate summary of what a project asks the renderer
 * to do — never a measured or promised frame rate, hardware score, or
 * exact timing. Every number here is either a plain count or a value
 * already bounded by `PerformanceTierCaps` (see `resolveParticleCount`),
 * so "approximate" means "real but not a live device measurement," not
 * "a guess."
 */
export function analyzePerformance(project: StudioProjectDocument, tier: "low" | "medium" | "high"): PerformanceReport {
  const caps: PerformanceTierCaps = PERFORMANCE_TIER_CAPS[tier];
  const containers: { label: string; container: MasterPage | Page | Popup }[] = [
    ...project.masters.map((m) => ({ label: `Master: ${m.name}`, container: m })),
    ...project.pages.map((p) => ({ label: `Page: ${p.name}`, container: p })),
    ...project.popups.map((p) => ({ label: `Popup: ${p.name}`, container: p })),
  ];

  let totalLayers = 0;
  const animatedLayerIds = new Set<string>();
  const animations: AnimationDeclaration[] = [];
  const effectLayers: EffectLayerSummary[] = [];

  for (const { label, container } of containers) {
    walkLayers(container.layers, (layer) => {
      totalLayers += 1;
      if (layer.type === "effect") {
        effectLayers.push({
          layerId: layer.id,
          containerLabel: label,
          name: layer.name,
          kind: layer.effect.kind,
          intensity: layer.effect.intensity,
          approxParticleCount: resolveParticleCount(layer.effect.intensity, caps),
        });
      }
    });
    for (const animation of container.animations) {
      animations.push(animation);
      animatedLayerIds.add(animation.targetLayerId);
    }
  }

  const largeAssets: LargeAssetSummary[] = project.assets.filter((a) => a.sizeBytes >= LARGE_ASSET_BYTES).map((a) => ({ assetId: a.id, name: a.name ?? a.originalFileName ?? a.path, sizeBytes: a.sizeBytes }));

  return {
    tier,
    totalLayers,
    animatedLayerIds,
    animations,
    effectLayers,
    effectLayersOverCap: effectLayers.length > caps.maxEffectLayers,
    largeAssets,
    designWarnings: checkDesignWarnings(project),
  };
}
