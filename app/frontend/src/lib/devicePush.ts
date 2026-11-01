const OWNER_KEY = 'amanah-push-device-owner';
let deviceOperation: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = deviceOperation.catch(() => undefined).then(operation);
  deviceOperation = next;
  return next;
}

// A browser subscription belongs to the browser, so rotate it across account
// changes rather than registering the same private endpoint for two accounts.
export function accountPushSubscription(registration: ServiceWorkerRegistration, userId: string, applicationServerKey: Uint8Array<ArrayBuffer>): Promise<PushSubscription> {
  return serialize(async () => {
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && localStorage.getItem(OWNER_KEY) !== userId) {
    if (!await subscription.unsubscribe()) throw Error('Device notification reset failed');
    subscription = null;
    localStorage.removeItem(OWNER_KEY);
  }
  return subscription ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  });
}
export function recordPushOwner(userId: string) { localStorage.setItem(OWNER_KEY, userId); }

export function releaseDevicePush(): Promise<void> {
  return serialize(async () => {
  // Local revocation prevents future delivery even if the API is unavailable.
  // Never wait for serviceWorker.ready: a device may have no active worker.
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && !await subscription.unsubscribe()) throw Error('Device revocation failed');
    }
    localStorage.removeItem(OWNER_KEY);
  } catch {
    throw new Error('Device notifications could not be disabled. Disable notifications in browser settings before sharing this device.');
  }
  });
}
