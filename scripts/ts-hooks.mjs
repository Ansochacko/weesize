export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(ts|js|mjs|cjs|json|css|svg)$/.test(specifier)) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
