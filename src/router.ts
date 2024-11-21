export function getExampleFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("example");
}

export function setExampleInURL(exampleKey: string) {
  const params = new URLSearchParams(window.location.search);
  params.set("example", exampleKey);
  window.history.replaceState({}, "", `?${params.toString()}`);
}
