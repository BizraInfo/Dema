export async function fetchNodeResources(fetchImpl, signal) {
  const response = await fetchImpl("/api/node-resources", {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
