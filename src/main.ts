import { initWebGPU } from "./webgpu/initWebGPU";
import { createPipeline } from "./webgpu/pipeline";

(async () => {
  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  const { device, context, format } = await initWebGPU(canvas);

  const pipeline = await createPipeline(device, format);

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  renderPass.setPipeline(pipeline);
  renderPass.draw(3);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
})();
