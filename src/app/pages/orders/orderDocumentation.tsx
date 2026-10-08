import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import type { Order } from '../master-data/data';

export const ORDER_DOCUMENTATION_ITEMS = [
  { key: 'before', label: 'Sebelum' },
  { key: 'after', label: 'Sesudah' },
  { key: 'payment', label: 'Bayar' },
  { key: 'signature', label: 'TTD' },
] as const;

export type OrderDocumentationKey = typeof ORDER_DOCUMENTATION_ITEMS[number]['key'];

export const ORDER_PHOTO_INITIAL_LIMIT = 4;

export function getOrderPhotoUrls(order: Order | null | undefined, type: OrderDocumentationKey) {
  const value = (order?.photos as Record<string, unknown> | null | undefined)?.[type];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return Array.isArray(value)
    ? value.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];
}

export function getOrderDocumentationSummary(order: Order) {
  const items = ORDER_DOCUMENTATION_ITEMS.map((item) => {
    const count = getOrderPhotoUrls(order, item.key);
    return { ...item, count: count.length };
  });
  const completed = items.filter((item) => item.count > 0).length;
  const missingLabels = items.filter((item) => item.count === 0).map((item) => item.label);
  const total = ORDER_DOCUMENTATION_ITEMS.length;

  return {
    completed,
    total,
    isComplete: completed === total,
    isEmpty: completed === 0,
    label: `${completed}/${total}`,
    tooltip: completed === total
      ? 'Dokumentasi lengkap'
      : `Dokumentasi belum lengkap: ${missingLabels.join(', ')}`,
  };
}

export function getInitialPhotoTab(order: Order): OrderDocumentationKey {
  return ORDER_DOCUMENTATION_ITEMS.find((item) => getOrderPhotoUrls(order, item.key).length > 0)?.key || 'before';
}

export function OrderDocumentationImage({
  src,
  alt,
  priority = false,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div className="orderPhotoImageFrame group">
      {!loaded && !failed && (
        <div className="orderPhotoImageLoading">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Memuat foto...</span>
        </div>
      )}
      {failed ? (
        <div className="orderPhotoImageFallback">
          <ImageOff className="h-8 w-8" />
          <span>Foto gagal dimuat</span>
          <a href={src} target="_blank" rel="noopener noreferrer">
            Buka file
          </a>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`orderPhotoImage ${loaded ? 'isLoaded' : ''}`}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!failed && (
        <>
          <div className="orderPhotoImageShade" />
          <div className="orderPhotoImageActions">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="orderPhotoImageOpen"
            >
              Lihat Full Size
            </a>
          </div>
        </>
      )}
    </div>
  );
}
