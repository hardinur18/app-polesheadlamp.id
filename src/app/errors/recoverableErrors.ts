export const DOM_MUTATION_RELOAD_MARKER = 'rhi-dom-mutation-reload-at';
export const STALE_CHUNK_RELOAD_MARKER = 'rhi-stale-chunk-reload-at';

const getErrorText = (reason: unknown) => {
  if (!reason) return '';

  if (reason instanceof Error) {
    return `${reason.name} ${reason.message} ${reason.stack ?? ''}`;
  }

  if (typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }

  return String(reason);
};

export const isReactDomRemovalError = (reason: unknown) => {
  const text = getErrorText(reason);

  return /NotFoundError/i.test(text)
    && /removeChild/i.test(text)
    && /not a child/i.test(text);
};

export const isStaleChunkError = (reason: unknown) => {
  const text = getErrorText(reason);

  return /Failed to fetch dynamically imported module/i.test(text)
    || /Importing a module script failed/i.test(text)
    || /vite:preloadError/i.test(text);
};

export const reloadOnce = (marker: string, cooldownMs = 10_000) => {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  const lastReload = Number(window.sessionStorage.getItem(marker) ?? 0);

  if (lastReload && now - lastReload <= cooldownMs) {
    return false;
  }

  window.sessionStorage.setItem(marker, String(now));
  window.location.reload();
  return true;
};

export const installReactDomMutationGuard = () => {
  if (typeof window === 'undefined' || typeof Node === 'undefined') return;

  const guardFlag = '__rhiReactDomMutationGuardInstalled';
  const guardedWindow = window as Window & { [guardFlag]?: boolean };

  if (guardedWindow[guardFlag]) return;

  guardedWindow[guardFlag] = true;

  const nativeRemoveChild = Node.prototype.removeChild;
  const nativeInsertBefore = Node.prototype.insertBefore;
  const nativeAppendChild = Node.prototype.appendChild;

  Node.prototype.removeChild = function removeChildGuard<T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }

    return nativeRemoveChild.call(this, child) as T;
  };

  Node.prototype.insertBefore = function insertBeforeGuard<T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return nativeAppendChild.call(this, newNode) as T;
    }

    return nativeInsertBefore.call(this, newNode, referenceNode) as T;
  };
};
