import { initWebGPU } from "./webgpu/initWebGPU";
import { setupDropdown } from "./ui/dropdown";
import { getExampleFromURL, setExampleInURL } from "./router";
import { examples, ExampleKeys } from "./webgpu/experiments";

function resizeCanvas(canvas: HTMLCanvasElement) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
}


(async () => {
  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  const { device, context, format } = await initWebGPU(canvas);

  let currentKey= setupDropdown(examples, (exampleKey) => {
    setExampleInURL(exampleKey); // Update URL params
    loadExample(exampleKey); // Load selected example
    currentKey = exampleKey;
  });
  function resizeCanvasAndConfigure() {
    resizeCanvas(canvas);
    context.configure({
      device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: "premultiplied",
    });
    loadExample(currentKey);
  }

  let cleanupFn: (() => void) | null = null;

  async function loadExample(exampleKey: ExampleKeys) {
    if (cleanupFn) {
      cleanupFn(); // Cleanup previous example
    }

    const example = examples[exampleKey];
    if (!example) {
      console.error(`Example "${exampleKey}" not found.`);
      return;
    }
    console.log("starting example", exampleKey);
    cleanupFn = await example.main(device, context, format);
  }

  // Get the initial example from the URL and load it
  currentKey = getExampleFromURL() || "random_triangles_1";

  // Configure initially
  resizeCanvasAndConfigure();

  // Reconfigure on resize
  // window.addEventListener("resize", resizeCanvasAndConfigure);
})();
