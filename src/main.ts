import { initWebGPU } from "./webgpu/initWebGPU";
import { setupDropdown } from "./ui/dropdown";
import { getExampleFromURL, setExampleInURL } from "./router";
import { examples } from "./webgpu/experiments";

function resizeCanvas(canvas: HTMLCanvasElement) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
}

(async () => {
  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  const { device, context, format } = await initWebGPU(canvas);

  let currentKey = "random_triangles_1";

  function resizeCanvasAndConfigure() {
    resizeCanvas(canvas);
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "premultiplied",
    });
    loadExample(currentKey);
  }

  setupDropdown((exampleKey) => {
    setExampleInURL(exampleKey); // Update URL params
    loadExample(exampleKey); // Load selected example
    currentKey = exampleKey;
  });

  // Load the example based on the URL parameter
  async function loadExample(exampleKey: string) {
    if (!examples[exampleKey]) {
      console.error(`Example "${exampleKey}" not found.`);
      return;
    }

    // Clear the canvas and stop previous example if needed
    canvas.width = canvas.width; // Resets the canvas
    const example = examples[exampleKey];

    // Initialize the example
    await example(device, context, format);
  }

  // Get the initial example from the URL and load it
  const initialExample = getExampleFromURL() || "random_triangles_1";
  loadExample(initialExample);

  // Configure initially
  resizeCanvasAndConfigure();

  // Reconfigure on resize
  window.addEventListener("resize", resizeCanvasAndConfigure);
})();
