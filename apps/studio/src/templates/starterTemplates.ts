import { createId, createProject, DEFAULT_CANVAS_SIZE } from "@fdraft/theme-sdk";
import type { Layer, StudioProjectDocument, TextLayer, Transform } from "@fdraft/theme-sdk";
import { createFdraftDefaultEventProject } from "./fdraftEventTemplate.js";

export type StarterTemplateId = "standard-fdraft" | "immersive" | "minimal" | "poster" | "blank";

export interface StarterTemplateDescriptor {
  id: StarterTemplateId;
  label: string;
  description: string;
}

export const STARTER_TEMPLATES: StarterTemplateDescriptor[] = [
  { id: "standard-fdraft", label: "Standard FDraft", description: "All 8 registered FDraft event surfaces, ready to theme — the guaranteed default." },
  { id: "immersive", label: "Immersive", description: "A single full-bleed page for a bold, image-first landing experience." },
  { id: "minimal", label: "Minimal", description: "A bare single page with just a title — build up from nothing." },
  { id: "poster", label: "Poster", description: "A tall, portrait-oriented single page for a poster-style announcement." },
  { id: "blank", label: "Blank", description: "An empty project with no pages at all." },
];

function titleLayer(text: string, transform: Transform, fontSizePx = 64): TextLayer {
  return {
    id: createId(),
    type: "text",
    name: "Title",
    text,
    fontSizePx,
    align: "center",
    transform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: 0,
    responsive: [],
    interactionStates: [],
  };
}

function backgroundShape(transform: Transform): Layer {
  return {
    id: createId(),
    type: "shape",
    name: "Background",
    shape: "rect",
    transform,
    opacity: 1,
    visible: true,
    locked: false,
    zIndex: -1,
    responsive: [],
    interactionStates: [],
  };
}

/**
 * Every starter template is a plain `StudioProjectDocument` built through
 * the same schema and `createProject`/layer shapes any other project
 * uses — never a special one-off rendering path. Opening one is
 * indistinguishable, from the editor's point of view, from opening any
 * hand-built project that happened to end up with the same content.
 */
export function createStarterProject(templateId: StarterTemplateId, name: string): StudioProjectDocument {
  switch (templateId) {
    case "standard-fdraft":
      return createFdraftDefaultEventProject(name);

    case "immersive": {
      const project = createProject({ id: createId(), name });
      const { width, height } = DEFAULT_CANVAS_SIZE;
      project.pages.push({
        id: createId(),
        name: "Home",
        slug: "home",
        layers: [backgroundShape({ x: 0, y: 0, width, height, rotationDeg: 0, scaleX: 1, scaleY: 1 }), titleLayer(name, { x: 120, y: height / 2 - 80, width: width - 240, height: 160, rotationDeg: 0, scaleX: 1, scaleY: 1 }, 96)],
        animations: [],
      });
      return project;
    }

    case "minimal": {
      const project = createProject({ id: createId(), name });
      const { width } = DEFAULT_CANVAS_SIZE;
      project.pages.push({ id: createId(), name: "Home", slug: "home", layers: [titleLayer(name, { x: 80, y: 80, width: width - 160, height: 120, rotationDeg: 0, scaleX: 1, scaleY: 1 })], animations: [] });
      return project;
    }

    case "poster": {
      const project = createProject({ id: createId(), name });
      const canvas = { width: 1080, height: 1920 };
      project.canvas = canvas;
      project.pages.push({
        id: createId(),
        name: "Poster",
        slug: "poster",
        layers: [backgroundShape({ x: 0, y: 0, width: canvas.width, height: canvas.height, rotationDeg: 0, scaleX: 1, scaleY: 1 }), titleLayer(name, { x: 60, y: 120, width: canvas.width - 120, height: 240, rotationDeg: 0, scaleX: 1, scaleY: 1 }, 88)],
        animations: [],
      });
      return project;
    }

    case "blank":
    default:
      return createProject({ id: createId(), name });
  }
}
