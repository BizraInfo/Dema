export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server" || specifier === "next/headers") {
    return nextResolve(`${specifier}.js`, context);
  }
  return nextResolve(specifier, context);
}
