import { main as random_triangles_1 } from "./random_triangles_1";
import { main as conways_2d_js } from "./conways_2d_js";
import { main as conways_2d_gpu } from "./conways_2d_gpu";
// import { run as example2 } from './example2/example';

/**
 * Each example should return a clean up function which can be used like:
 * 
  ========== in the example main ==================
  // Start animation
  let animationId = requestAnimationFrame(function frame() {
    render();
    animationId = requestAnimationFrame(frame);
  });

  // Return cleanup function
  return () => {
    cancelAnimationFrame(animationId);
    // Release resources
  };
 */
// }
export type MainFunction = (
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) => Promise<() => void>;

export const examples = {
  random_triangles_1: {
    label: "Random Triangles",
    main: random_triangles_1,
  },
  conways_2d_js: {
    label: "Conways 2D JS",
    main: conways_2d_js
  },
  conways_2d_gpu: {
    label: "Conways 2D GPU",
    main: conways_2d_gpu
  }
} as const;

export type ExampleRecord = typeof examples;
export type ExampleKeys = keyof ExampleRecord;

export function isExampleKey(input?: string | null): input is ExampleKeys  {
  if (!input) {
    return false;
  }
  return examples[input as ExampleKeys] !== undefined;
}
// export const examples: Record<
//   string,
//   (
//     device: GPUDevice,
//     context: GPUCanvasContext,
//     format: GPUTextureFormat
//   ) => Promise<() => void>
// > = {
//   random_triangles_1,
//   conways_2d,
// };
