import type { AnimationDeclaration, Id, Layer, MasterPage, Page, Popup, StudioProjectDocument } from "@fdraft/theme-sdk";

export type ContainerKind = "page" | "popup" | "master";

export interface ContainerRef {
  kind: ContainerKind;
  id: Id;
}

export function getContainer(project: StudioProjectDocument, ref: ContainerRef): Page | Popup | MasterPage | undefined {
  if (ref.kind === "page") return project.pages.find((p) => p.id === ref.id);
  if (ref.kind === "popup") return project.popups.find((p) => p.id === ref.id);
  return project.masters.find((m) => m.id === ref.id);
}

export function getContainerLayers(project: StudioProjectDocument, ref: ContainerRef): Layer[] {
  return getContainer(project, ref)?.layers ?? [];
}

export function updateContainerLayers(project: StudioProjectDocument, ref: ContainerRef, updater: (layers: Layer[]) => Layer[]): StudioProjectDocument {
  if (ref.kind === "page") {
    return { ...project, pages: project.pages.map((p) => (p.id === ref.id ? { ...p, layers: updater(p.layers) } : p)) };
  }
  if (ref.kind === "popup") {
    return { ...project, popups: project.popups.map((p) => (p.id === ref.id ? { ...p, layers: updater(p.layers) } : p)) };
  }
  return { ...project, masters: project.masters.map((m) => (m.id === ref.id ? { ...m, layers: updater(m.layers) } : m)) };
}

export function getContainerAnimations(project: StudioProjectDocument, ref: ContainerRef): AnimationDeclaration[] {
  return getContainer(project, ref)?.animations ?? [];
}

export function updateContainerAnimations(project: StudioProjectDocument, ref: ContainerRef, updater: (animations: AnimationDeclaration[]) => AnimationDeclaration[]): StudioProjectDocument {
  if (ref.kind === "page") {
    return { ...project, pages: project.pages.map((p) => (p.id === ref.id ? { ...p, animations: updater(p.animations) } : p)) };
  }
  if (ref.kind === "popup") {
    return { ...project, popups: project.popups.map((p) => (p.id === ref.id ? { ...p, animations: updater(p.animations) } : p)) };
  }
  return { ...project, masters: project.masters.map((m) => (m.id === ref.id ? { ...m, animations: updater(m.animations) } : m)) };
}
