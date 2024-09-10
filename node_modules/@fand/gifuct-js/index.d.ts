declare module "@fand/gifuct-js" {
    export interface IGIFFrame {
        pixels: number[];
        dims: {
            top: number;
            left: number;
            width: number;
            height: number;
        };
        delay: number;
        disposalType: number;
        colorTable: number[];
        transparentIndex: number;
        patch: Uint8ClampedArray;
    }

    export default class GIF {
        raw: any;
        constructor(arrayBuffer: ArrayBuffer);
        decompressFrame(index: number, buildPatch: boolean): IGIFFrame | null;
        decompressFrames(
            buildPatch: boolean,
            startFrame?: number,
            endFrame?: number
        ): IGIFFrame[];
    }
}
