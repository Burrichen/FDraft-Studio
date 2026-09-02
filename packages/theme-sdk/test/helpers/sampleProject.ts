import type { StudioProjectDocument } from "../../src/schema/project.js";
import { CURRENT_PROJECT_FORMAT_VERSION } from "../../src/schema/versions.js";
import { sha256Hex } from "../../src/packaging/hash.js";

/**
 * Fixed, hand-picked UUIDs (not regenerated per run) so this fixture's
 * `project.json` is stable and Git-diffable across regenerations. Real
 * UUIDs, generated once with `crypto.randomUUID()`.
 */
export const SAMPLE_IDS = {
  colorPrimary: "30fa0fcb-8d21-4f6f-8e1d-cf202ac33a40",
  fontHeading: "af2f9c00-3840-450f-9897-968ab7044c03",
  fontAsset: "1e5c58c1-10dd-4ace-9f06-af036d6958ba",
  breakpointMobile: "6e31516b-c66d-4489-b8bc-e179496939fc",
  breakpointDesktop: "c5998596-7a03-441c-9701-7f88f73e9c19",
  posterAsset: "4cab67b2-d112-456a-88bd-c067dc03e6d1",
  bgDefaultAsset: "3bab1091-999c-4d60-b699-0f59bf9c8842",
  bgHoverAsset: "ed40a09f-14b1-42dc-b02a-36a2f9c9214f",
  stateGroup: "4306306e-b300-4267-b96b-6d0c3a11524c",
  stateDefault: "c5112fbf-c589-4282-9318-35239104e5cc",
  stateHover: "02a0ce84-883a-4c38-a81e-e590fc7e4dde",
  componentReq: "f36b2845-a0ed-4bfa-a31f-e039e9d6a9e3",
  componentStyleOverride: "a1c3ea38-8d07-4f26-8381-3b22b9570d35",
  master: "056d7aaf-acf4-4ced-9643-9c9ee0f742b5",
  masterBgLayer: "6c17b000-ee24-4c85-b5d2-29c103bc8722",
  masterGroupLayer: "78103b55-1184-47d4-b42a-4d8abd8eaa99",
  masterShapeLayer: "3dd75523-572a-483f-85a2-e9c2b6ea7c97",
  page: "19dee7b0-a59e-44f4-b32a-07d07949cc50",
  pageImageLayer: "30fd6566-8f77-4fda-841a-22ab203b147f",
  pageTextLayer: "83f1c084-a192-4c1b-8650-daa3d4ce79d8",
  pageComponentLayer: "90df1bc5-c78e-442a-821d-bea1d74e215b",
  pageInteractionState: "c8068822-2e89-4a48-af39-83bb1a10448d",
  pageAnimation: "b3938424-63ad-40ef-bf9f-b4aacb70bde7",
  popup: "62c7fa25-e8f4-48bb-80f6-3c5615073a79",
  popupTextLayer: "e847d0ac-a840-4dae-8d49-9a4991be1e43",
  behaviourRule: "9b6c8f2a-2e77-4b3a-9c0e-9a6a9f6a8a1a",
  project: "783813dd-b176-43ac-ba8a-0d821a32cae6",
} as const;

// Tiny, deliberately non-photographic asset payloads — content never needs
// to be a real decodable image/font for anything the SDK does in this
// phase (no pixel/glyph parsing exists yet), only distinct, hashable bytes.
const POSTER_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);
const BG_DEFAULT_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 10, 20, 30]);
const BG_HOVER_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 40, 50, 60]);
const HEADING_WOFF2 = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 9, 9, 9, 9, 9]);

export interface SampleProjectFixture {
  project: StudioProjectDocument;
  assets: Record<string, Uint8Array>;
}

/**
 * A deliberately small, hand-authored fixture theme exercising every data
 * model area Prompt 2 requires: a master, a page, a popup, an image layer,
 * a text layer, a group, a component placeholder, a responsive anchor, an
 * image-state group, a `stateEquals` condition, and an animation
 * declaration — all wired together with real (fixed) ids and bundled
 * local assets.
 */
export async function buildSampleProject(): Promise<SampleProjectFixture> {
  const posterPath = "assets/4cab67b2-poster.png";
  const bgDefaultPath = "assets/3bab1091-bg-default.png";
  const bgHoverPath = "assets/ed40a09f-bg-hover.png";
  const fontPath = "assets/af2f9c00-heading.woff2";

  const [posterHash, bgDefaultHash, bgHoverHash, fontHash] = await Promise.all([
    sha256Hex(POSTER_PNG),
    sha256Hex(BG_DEFAULT_PNG),
    sha256Hex(BG_HOVER_PNG),
    sha256Hex(HEADING_WOFF2),
  ]);

  const project: StudioProjectDocument = {
    formatVersion: CURRENT_PROJECT_FORMAT_VERSION,
    metadata: {
      id: SAMPLE_IDS.project,
      name: "Sample Event Theme",
      description: "Hand-authored fixture covering every Prompt 2 data-model area.",
    },
    canvas: { width: 1920, height: 1080 },
    tokens: {
      colors: [{ id: SAMPLE_IDS.colorPrimary, name: "Primary", value: "#FF6600" }],
      gradients: [],
      shadows: [],
      borders: [],
      spacing: [],
      radii: [],
      fonts: [
        {
          id: SAMPLE_IDS.fontHeading,
          name: "Heading Font",
          assetId: SAMPLE_IDS.fontAsset,
          fallbackFamily: "sans-serif",
          weight: 700,
          italic: false,
        },
      ],
      breakpoints: [
        { id: SAMPLE_IDS.breakpointMobile, name: "Mobile", minWidthPx: 0 },
        { id: SAMPLE_IDS.breakpointDesktop, name: "Desktop", minWidthPx: 1024 },
      ],
    },
    assets: [
      { id: SAMPLE_IDS.posterAsset, kind: "image", path: posterPath, mimeType: "image/png", sizeBytes: POSTER_PNG.byteLength, sha256: posterHash },
      { id: SAMPLE_IDS.bgDefaultAsset, kind: "image", path: bgDefaultPath, mimeType: "image/png", sizeBytes: BG_DEFAULT_PNG.byteLength, sha256: bgDefaultHash },
      { id: SAMPLE_IDS.bgHoverAsset, kind: "image", path: bgHoverPath, mimeType: "image/png", sizeBytes: BG_HOVER_PNG.byteLength, sha256: bgHoverHash },
      { id: SAMPLE_IDS.fontAsset, kind: "font", path: fontPath, mimeType: "font/woff2", sizeBytes: HEADING_WOFF2.byteLength, sha256: fontHash },
    ],
    assetFolders: [],
    imageStateGroups: [
      {
        id: SAMPLE_IDS.stateGroup,
        name: "Poster background state",
        defaultStateId: SAMPLE_IDS.stateDefault,
        states: [
          { id: SAMPLE_IDS.stateDefault, name: "Default", assetId: SAMPLE_IDS.bgDefaultAsset },
          { id: SAMPLE_IDS.stateHover, name: "Hover", assetId: SAMPLE_IDS.bgHoverAsset },
        ],
      },
    ],
    componentRequirements: [
      {
        id: SAMPLE_IDS.componentReq,
        componentKey: "opt-in-button",
        required: true,
        allowedProperties: ["color", "backgroundColor", "borderRadius"],
      },
    ],
    masters: [
      {
        id: SAMPLE_IDS.master,
        name: "Event Master",
        layers: [
          {
            id: SAMPLE_IDS.masterGroupLayer,
            type: "group",
            name: "Background Group",
            transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: 0,
            responsive: [],
            interactionStates: [],
            children: [
              {
                id: SAMPLE_IDS.masterBgLayer,
                type: "image",
                name: "Background Image",
                assetId: SAMPLE_IDS.posterAsset,
                transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, scaleX: 1, scaleY: 1 },
                opacity: 1,
                visible: true,
                locked: false,
                zIndex: 0,
                responsive: [],
                interactionStates: [],
              },
              {
                id: SAMPLE_IDS.masterShapeLayer,
                type: "shape",
                name: "Footer Bar",
                shape: "rect",
                fillColorTokenId: SAMPLE_IDS.colorPrimary,
                transform: { x: 0, y: 1000, width: 1920, height: 80, rotationDeg: 0, scaleX: 1, scaleY: 1 },
                opacity: 1,
                visible: true,
                locked: false,
                zIndex: 1,
                responsive: [],
                interactionStates: [],
              },
            ],
          },
        ],
        animations: [],
      },
    ],
    pages: [
      {
        id: SAMPLE_IDS.page,
        name: "Home",
        slug: "home",
        masterId: SAMPLE_IDS.master,
        layers: [
          {
            id: SAMPLE_IDS.pageImageLayer,
            type: "image",
            name: "Poster",
            assetId: SAMPLE_IDS.bgDefaultAsset,
            stateGroupId: SAMPLE_IDS.stateGroup,
            transform: { x: 100, y: 100, width: 400, height: 600, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: 1,
            responsive: [
              {
                breakpointId: SAMPLE_IDS.breakpointMobile,
                anchors: [{ edge: "left", offset: 16, unit: "px" }],
                transformOverride: { width: 200, height: 300 },
              },
            ],
            interactionStates: [
              {
                id: SAMPLE_IDS.pageInteractionState,
                name: "Hovered",
                condition: { type: "stateEquals", stateGroupId: SAMPLE_IDS.stateGroup, stateId: SAMPLE_IDS.stateHover },
                opacity: 0.9,
              },
            ],
          },
          {
            id: SAMPLE_IDS.pageTextLayer,
            type: "text",
            name: "Welcome heading",
            text: "Welcome to the event!",
            fontTokenId: SAMPLE_IDS.fontHeading,
            colorTokenId: SAMPLE_IDS.colorPrimary,
            fontSizePx: 48,
            align: "center",
            transform: { x: 0, y: 40, width: 1920, height: 100, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: 2,
            responsive: [],
            interactionStates: [],
          },
          {
            id: SAMPLE_IDS.pageComponentLayer,
            type: "component",
            name: "Opt-in button",
            componentKey: "opt-in-button",
            componentRequirementId: SAMPLE_IDS.componentReq,
            styleOverrides: [
              {
                id: SAMPLE_IDS.componentStyleOverride,
                componentRequirementId: SAMPLE_IDS.componentReq,
                style: { backgroundColor: "#FF6600", borderRadius: 8 },
              },
            ],
            transform: { x: 860, y: 900, width: 200, height: 56, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: 3,
            responsive: [],
            interactionStates: [],
          },
        ],
        animations: [
          {
            id: SAMPLE_IDS.pageAnimation,
            name: "Poster fade-in",
            trigger: "onEnter",
            targetLayerId: SAMPLE_IDS.pageImageLayer,
            property: "opacity",
            from: 0,
            to: 1,
            durationMs: 800,
            delayMs: 0,
            easing: "easeOut",
            loop: false,
            direction: "normal",
            intensity: 1,
          },
        ],
      },
    ],
    popups: [
      {
        id: SAMPLE_IDS.popup,
        name: "Welcome popup",
        masterId: SAMPLE_IDS.master,
        trigger: "onLoad",
        layers: [
          {
            id: SAMPLE_IDS.popupTextLayer,
            type: "text",
            name: "Popup message",
            text: "Don't miss this year's event!",
            fontSizePx: 24,
            align: "center",
            transform: { x: 0, y: 0, width: 600, height: 200, rotationDeg: 0, scaleX: 1, scaleY: 1 },
            opacity: 1,
            visible: true,
            locked: false,
            zIndex: 0,
            responsive: [],
            interactionStates: [],
          },
        ],
        animations: [],
      },
    ],
    // Demonstrates the Prompt 8 rule engine on top of the same poster
    // background state group the pre-existing `stateEquals` InteractionState
    // above only *reacts* to — this rule *causes* the state switch: hovering
    // the poster for real drives its own image-state group, not just a
    // static opacity tweak. A real cross-host contract fixture for Prompt 10.
    behaviourRules: [
      {
        id: SAMPLE_IDS.behaviourRule,
        name: "Swap poster background on hover",
        enabled: true,
        priority: 0,
        trigger: { type: "whileTrue" },
        condition: { type: "boolean", variable: { kind: "interactionFlag", which: "hover", layerId: SAMPLE_IDS.pageImageLayer }, equals: true },
        actions: [{ type: "setImageState", stateGroupId: SAMPLE_IDS.stateGroup, stateId: SAMPLE_IDS.stateHover }],
      },
    ],
  };

  return {
    project,
    assets: {
      [posterPath]: POSTER_PNG,
      [bgDefaultPath]: BG_DEFAULT_PNG,
      [bgHoverPath]: BG_HOVER_PNG,
      [fontPath]: HEADING_WOFF2,
    },
  };
}
