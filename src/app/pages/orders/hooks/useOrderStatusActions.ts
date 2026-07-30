import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Order } from '../../master-data/data';
import { isReasonRequiredStatus } from '../cancelReasonOptions';
import { getStatusLabel } from '../orderHelpers';
import { logActivity } from '@/app/services/auditService';

interface UseOrderStatusActionsParams {
  updateOrder: (order: any) => any;
  currentUser: any;
}

export function useOrderStatusActions({
  updateOrder,
  currentUser,
}: UseOrderStatusActionsParams) {
  const [quickStatusChange, setQuickStatusChange] = useState<null | {
    order: Order;
    nextStatus: Extract<Order['status'], 'cancelled' | 'reschedule'>;
  }>(null);
  const [quickStatusReason, setQuickStatusReason] = useState('');
  const [quickStatusReasonNote, setQuickStatusReasonNote] = useState('');

  // Price editing
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');

  const resetQuickStatusChange = useCallback(() => {
    setQuickStatusChange(null);
    setQuickStatusReason('');
    setQuickStatusReasonNote('');
  }, []);

  const buildStatusUpdatePayload = useCallback((
    order: Order,
    nextStatus: Order['status'],
    reason?: string,
    reasonNote?: string,
  ) => {
    const nextPhotos = order.photos ? { ...order.photos } : order.photos;
    if (nextPhotos && (nextPhotos as any)._status) {
      delete (nextPhotos as any)._status;
    }

    const updatedOrder: Order = {
      ...order,
      status: nextStatus,
      photos: nextPhotos,
    };

    if (isReasonRequiredStatus(nextStatus)) {
      updatedOrder.cancelReason = reason;
      updatedOrder.cancelReasonNote = reason === 'Lainnya' ? reasonNote?.trim() || undefined : undefined;

      if (order.status !== nextStatus) {
        updatedOrder.isFollowedUp = false;
        updatedOrder.followedUpBy = undefined;
        updatedOrder.followedUpAt = undefined;
        updatedOrder.followUpNote = undefined;
      }
    } else {
      updatedOrder.cancelReason = undefined;
      updatedOrder.cancelReasonNote = undefined;
    }

    return updatedOrder;
  }, []);

  const openQuickStatusChange = useCallback((
    order: Order,
    nextStatus: Extract<Order['status'], 'cancelled' | 'reschedule'>,
  ) => {
    setQuickStatusChange({ order, nextStatus });
    setQuickStatusReason(order.status === nextStatus ? order.cancelReason || '' : '');
    setQuickStatusReasonNote(order.status === nextStatus ? order.cancelReasonNote || '' : '');
  }, []);

  const handleInlineStatusChange = useCallback(async (order: Order, nextStatus: Order['status']) => {
    if (order.status === nextStatus) return;

    if (isReasonRequiredStatus(nextStatus)) {
      openQuickStatusChange(order, nextStatus as Extract<Order['status'], 'cancelled' | 'reschedule'>);
      return;
    }

    try {
      await updateOrder(buildStatusUpdatePayload(order, nextStatus));
      toast.success(`Status diperbarui menjadi ${getStatusLabel(nextStatus)}`);
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Pesanan',
          `Mengubah status pesanan ${order.customerName} menjadi ${getStatusLabel(nextStatus)}`,
          order.id,
          { previousStatus: order.status, newStatus: nextStatus }
        );
      }
    } catch (error) {
      console.error(error);
      toast.error('Gagal memperbarui status pesanan');
    }
  }, [updateOrder, buildStatusUpdatePayload, openQuickStatusChange, currentUser]);

  const handleConfirmQuickStatusChange = useCallback(async () => {
    if (!quickStatusChange) return;

    if (!quickStatusReason) {
      toast.error(
        `Mohon pilih alasan ${quickStatusChange.nextStatus === 'cancelled' ? 'pembatalan' : 'jadwal ulang'}`,
      );
      return;
    }

    if (quickStatusReason === 'Lainnya' && !quickStatusReasonNote.trim()) {
      toast.error('Mohon jelaskan alasan lainnya');
      return;
    }

    try {
      await updateOrder(
        buildStatusUpdatePayload(
          quickStatusChange.order,
          quickStatusChange.nextStatus,
          quickStatusReason,
          quickStatusReasonNote,
        ),
      );
      toast.success(`Status diperbarui menjadi ${getStatusLabel(quickStatusChange.nextStatus)}`);
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Pesanan',
          `Mengubah status pesanan ${quickStatusChange.order.customerName} menjadi ${getStatusLabel(quickStatusChange.nextStatus)} (${quickStatusReason})`,
          quickStatusChange.order.id,
          { previousStatus: quickStatusChange.order.status, newStatus: quickStatusChange.nextStatus, reason: quickStatusReason }
        );
      }
      resetQuickStatusChange();
    } catch (error) {
      console.error(error);
      toast.error('Gagal memperbarui status pesanan');
    }
  }, [quickStatusChange, quickStatusReason, quickStatusReasonNote, updateOrder, buildStatusUpdatePayload, currentUser, resetQuickStatusChange]);

  return {
    quickStatusChange, setQuickStatusChange,
    quickStatusReason, setQuickStatusReason,
    quickStatusReasonNote, setQuickStatusReasonNote,
    editingPriceId, setEditingPriceId,
    tempPrice, setTempPrice,
    resetQuickStatusChange,
    buildStatusUpdatePayload,
    openQuickStatusChange,
    handleInlineStatusChange,
    handleConfirmQuickStatusChange,
  };
}
