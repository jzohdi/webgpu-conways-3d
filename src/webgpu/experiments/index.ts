import { main as random_triangles_1 } from "./random_triangles_1";
// import { run as example2 } from './example2/example';

export const examples: Record<
  string,
  (
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat
  ) => Promise<void>
> = {
  random_triangles_1,
};
