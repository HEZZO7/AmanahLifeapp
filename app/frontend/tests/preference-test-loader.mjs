// Node-only test resolver for bundler-style extensionless TypeScript imports.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === './notificationPreferenceClient' && (context.parentURL?.endsWith('/usePreferenceState.ts') || context.parentURL?.endsWith('/notificationBackup.ts'))) {
    return nextResolve(new URL('./notificationPreferenceClient.ts', context.parentURL).href, context);
  }
  if (specifier === './notificationBackup' && context.parentURL?.endsWith('/notificationPreferenceWrite.ts')) {
    return nextResolve(new URL('./notificationBackup.ts', context.parentURL).href, context);
  }
  return nextResolve(specifier, context);
}


