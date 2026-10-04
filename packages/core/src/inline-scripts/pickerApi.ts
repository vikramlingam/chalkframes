export type ChalkframePickerBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ChalkframePickerElementInfo = {
  id: string | null;
  tagName: string;
  selector: string;
  label: string;
  boundingBox: ChalkframePickerBoundingBox;
  textContent: string | null;
  src: string | null;
  dataAttributes: Record<string, string>;
};

export type ChalkframePickerApi = {
  enable: () => void;
  disable: () => void;
  isActive: () => boolean;
  getHovered: () => ChalkframePickerElementInfo | null;
  getSelected: () => ChalkframePickerElementInfo | null;
  getCandidatesAtPoint: (
    clientX: number,
    clientY: number,
    limit?: number,
  ) => ChalkframePickerElementInfo[];
  pickAtPoint: (
    clientX: number,
    clientY: number,
    index?: number,
  ) => ChalkframePickerElementInfo | null;
  pickManyAtPoint: (
    clientX: number,
    clientY: number,
    indexes?: number[],
  ) => ChalkframePickerElementInfo[];
  describe?: (element: Element) => ChalkframePickerElementInfo | null;
};

declare global {
  interface Window {
    __HF_PICKER_API?: ChalkframePickerApi;
  }
}
