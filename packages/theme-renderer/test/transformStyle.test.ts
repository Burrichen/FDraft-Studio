import { describe, expect, it } from "vitest";
import { fontSizeToCqw, layerBoxStyle, stageStyle } from "../src/transformStyle.js";

const canvas = { width: 1000, height: 500 };
const baseTransform = { x: 100, y: 50, width: 200, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 };

describe("stageStyle", () => {
  it("scales to the canvas aspect ratio", () => {
    expect(stageStyle(canvas).aspectRatio).toBe("1000 / 500");
  });

  it("falls back to the default canvas size when none is given", () => {
    expect(stageStyle(undefined).aspectRatio).toBe("1920 / 1080");
  });

  it("establishes an inline-size query container so text can scale with it", () => {
    expect(stageStyle(canvas).containerType).toBe("inline-size");
  });
});

describe("fontSizeToCqw", () => {
  it("expresses a design-space font size as a percentage of the stage's own rendered width", () => {
    // 48px authored against a 1920px-wide canvas is 2.5% of that canvas's width.
    expect(fontSizeToCqw(48, { width: 1920, height: 1080 })).toBe("2.5cqw");
  });

  it("falls back to the default canvas size when none is given", () => {
    expect(fontSizeToCqw(48, undefined)).toBe(fontSizeToCqw(48, { width: 1920, height: 1080 }));
  });
});

describe("layerBoxStyle", () => {
  it("expresses position/size as percentages of the canvas", () => {
    const style = layerBoxStyle({ transform: baseTransform, canvas, opacity: 1, visible: true, zIndex: 2, reducedMotion: false });
    expect(style.left).toBe("10%");
    expect(style.top).toBe("10%");
    expect(style.width).toBe("20%");
    expect(style.height).toBe("20%");
    expect(style.zIndex).toBe(2);
  });

  it("hides an invisible layer with display:none rather than skipping it", () => {
    const style = layerBoxStyle({ transform: baseTransform, canvas, opacity: 1, visible: false, zIndex: 0, reducedMotion: false });
    expect(style.display).toBe("none");
  });

  it("applies rotation and non-uniform scale as a CSS transform", () => {
    const style = layerBoxStyle({
      transform: { ...baseTransform, rotationDeg: 45, scaleX: 2, scaleY: 1 },
      canvas,
      opacity: 1,
      visible: true,
      zIndex: 0,
      reducedMotion: false,
    });
    expect(style.transform).toBe("rotate(45deg) scale(2, 1)");
  });

  it("disables transitions when reduced motion is requested", () => {
    const style = layerBoxStyle({ transform: baseTransform, canvas, opacity: 1, visible: true, zIndex: 0, reducedMotion: true });
    expect(style.transition).toBe("none");
  });
});
