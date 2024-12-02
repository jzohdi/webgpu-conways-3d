import { MainFunction } from "..";
import { getInstaneBuffer } from "./squares";
import { createPipeline } from "./squares/pipeline";

export const main: MainFunction = async (
  device: GPUDevice,
  context: GPUCanvasContext,
  format: GPUTextureFormat
) => {
  const instanceCount = 1000;
  const unitSquareVertexBuffer = getInstaneBuffer(instanceCount, device);
  const instanceBuffer = getInstaneBuffer(instanceCount, device);

  const pipeline = await createPipeline(device, format);

  const commandEncoder = device.createCommandEncoder();
  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.2, b: 0.3, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, unitSquareVertexBuffer); // Unit square vertices
  passEncoder.setVertexBuffer(1, instanceBuffer); // Instance data
  passEncoder.draw(6, instanceCount, 0, 0); // 6 vertices per square, instanceCount squares
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);

  return () => {};
}
