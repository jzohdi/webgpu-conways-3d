import { main as random_triangles_1 } from "./random_triangles_1";
import { main as conways_2d } from "./conways_2d";
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
export const examples: Record<
  string,
  (
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat
  ) => Promise<() => void>
> = {
  random_triangles_1,
  conways_2d,
};
