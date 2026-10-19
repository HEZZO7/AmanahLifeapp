// Synchronous hooks are available in the pinned Node >=22.15. No loader worker
// or network is needed; resolve only the subject fixture's three TS imports.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,nextResolve){
 const parent=context.parentURL??'';
 if(specifier==='./notificationPreferenceClient'&&(parent.endsWith('/usePreferenceState.ts')||parent.endsWith('/notificationBackup.ts')))
  return nextResolve(new URL('./notificationPreferenceClient.ts',parent).href,context);
 if(specifier==='./notificationBackup'&&parent.endsWith('/notificationPreferenceWrite.ts'))
  return nextResolve(new URL('./notificationBackup.ts',parent).href,context);
 return nextResolve(specifier,context);
}});
