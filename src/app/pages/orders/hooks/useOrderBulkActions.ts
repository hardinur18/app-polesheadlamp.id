import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Order } from '../../master-data/data';
import { isReasonRequiredStatus } from '../cancelReasonOptions';
import { logActivity } from '@/app/services/auditService';
import { supabase } from '@/lib/supabaseClient';

interface UseOrderBulkActionsParams {
  orders: Order[];
  services: any[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  updateOrder: (order: any) => any;
  deleteOrder: (id: string) => Promise<void>;
  currentUser: any;
  buildStatusUpdatePayload: (order: Order, nextStatus: Order['status'], reason?: string, reasonNote?: string) => Order;
}

export function useOrderBulkActions({
  orders,
  services,
  selectedIds,
  setSelectedIds,
  updateOrder,
  deleteOrder,
  currentUser,
  buildStatusUpdatePayload,
}: UseOrderBulkActionsParams) {
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkField, setBulkField] = useState<string>('');
  const [bulkValue, setBulkValue] = useState<string>('');
  const [bulkStatusReason, setBulkStatusReason] = useState('');
  const [bulkStatusReasonNote, setBulkStatusReasonNote] = useState('');
  const [isMassDeleteOpen, setIsMassDeleteOpen] = useState(false);

  const resetBulkEditor = useCallback(() => {
    setIsBulkEditOpen(false);
    setBulkField('');
    setBulkValue('');
    setBulkStatusReason('');
    setBulkStatusReasonNote('');
  }, []);

  const handleBulkUpdate = useCallback(async () => {
    if (!bulkField || !bulkValue) {
      toast.error("Mohon pilih field dan nilai yang akan diupdate");
      return;
    }

    if (bulkField === 'status' && isReasonRequiredStatus(bulkValue) && !bulkStatusReason) {
      toast.error(`Mohon pilih alasan ${bulkValue === 'cancelled' ? 'pembatalan' : 'jadwal ulang'}`);
      return;
    }

    if (bulkField === 'status' && bulkStatusReason === 'Lainnya' && !bulkStatusReasonNote.trim()) {
      toast.error("Mohon jelaskan alasan lainnya");
      return;
    }

    const toastId = toast.loading(`Mengupdate ${selectedIds.size} pesanan...`);

    let successCount = 0;
    const selectedOrders = orders.filter(o => selectedIds.has(o.id));
    const failedIds = new Set<string>();
    const failureDetails: string[] = [];

    for (const order of selectedOrders) {
      try {
        if (bulkField === 'status') {
          await updateOrder(
            buildStatusUpdatePayload(
              order,
              bulkValue as Order['status'],
              bulkStatusReason,
              bulkStatusReasonNote,
            ),
          );
          successCount++;
          continue;
        }

        const updates: any = {};
        let paymentProofPathsToRemove: string[] = [];
        if (bulkField === 'technicianId') updates.technicianId = bulkValue;
        else if (bulkField === 'csId') updates.csId = bulkValue;
        else if (bulkField === 'advertiserId') updates.advertiserId = bulkValue;
        else if (bulkField === 'branchId') updates.branchId = bulkValue;
        else if (bulkField === 'paymentStatus') updates.paymentStatus = bulkValue;
        else if (bulkField === 'serviceId') {
          updates.serviceId = bulkValue;
          const service = services.find(s => s.id === bulkValue);
          if (service) updates.price = service.price;
        }
        else if (bulkField === 'deletePaymentProof' && bulkValue === 'confirm') {
          const currentPhotos = order.photos || {};
          const paymentPhotos = (currentPhotos as any).payment || [];

          if (paymentPhotos.length > 0) {
            paymentProofPathsToRemove = paymentPhotos.map((url: string) => {
              const parts = url.split('/public/orders/');
              return parts.length > 1 ? parts[1] : null;
            }).filter(Boolean);
          }
          updates.photos = { ...currentPhotos, payment: [], paymentDeleted: true, paymentDeletedAt: new Date().toISOString() };
        }

        // @ts-ignore
        await updateOrder({ ...order, ...updates });
        if (paymentProofPathsToRemove.length > 0) {
          const { error: storageError } = await supabase.storage.from('orders').remove(paymentProofPathsToRemove);
          if (storageError) {
            console.warn('Failed to remove detached payment proof files:', storageError);
          }
        }
        successCount++;
      } catch (error: any) {
        console.error(error);
        failedIds.add(order.id);
        failureDetails.push(`${order.customerName}: ${error?.message || 'Gagal diperbarui'}`);
      }
    }

    toast.dismiss(toastId);
    if (successCount > 0) {
      toast.success(`${successCount} pesanan berhasil diperbarui`, {
        description: failureDetails.length > 0 ? `${failureDetails.length} pesanan gagal disimpan.` : undefined,
      });
    }
    if (failureDetails.length > 0) {
      toast.error(`${failureDetails.length} pesanan gagal diperbarui`, {
        description: failureDetails.slice(0, 2).join(' | '),
      });
      setSelectedIds(failedIds);
      return;
    }
    if (currentUser && successCount > 0) {
      logActivity(
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        'UPDATE',
        'Pesanan',
        `Memperbarui ${successCount} pesanan secara massal`,
        '',
        { count: successCount }
      );
    }
    resetBulkEditor();
    setSelectedIds(new Set());
  }, [bulkField, bulkValue, bulkStatusReason, bulkStatusReasonNote, selectedIds, orders, services, updateOrder, deleteOrder, currentUser, buildStatusUpdatePayload, setSelectedIds, resetBulkEditor]);

  const handleMassDelete = useCallback(() => {
    setIsMassDeleteOpen(true);
  }, []);

  const confirmMassDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    if (count === 0) return;

    let successCount = 0;
    const failedIds = new Set<string>();
    const failureDetails: string[] = [];
    const toastId = toast.loading(`Menghapus ${count} pesanan...`);

    for (const id of ids) {
      const order = orders.find(o => o.id === id);
      try {
        await deleteOrder(id);
        successCount++;
      } catch (error: any) {
        console.error(error);
        failedIds.add(id);
        failureDetails.push(`${order?.customerName || id}: ${error?.message || 'Gagal dihapus'}`);
      }
    }

    toast.dismiss(toastId);
    if (successCount > 0) {
      toast.success(`${successCount} pesanan berhasil dihapus`, {
        description: failureDetails.length > 0 ? `${failureDetails.length} pesanan gagal dihapus.` : undefined,
      });
    }
    if (failureDetails.length > 0) {
      toast.error(`${failureDetails.length} pesanan gagal dihapus`, {
        description: failureDetails.slice(0, 2).join(' | '),
      });
      setSelectedIds(failedIds);
    } else {
      setSelectedIds(new Set());
    }
    if (currentUser && successCount > 0) {
      logActivity(
        { id: currentUser.id, name: currentUser.name, role: currentUser.role },
        'DELETE',
        'Pesanan',
        `Menghapus ${successCount} pesanan secara massal`,
        '',
        { count: successCount }
      );
    }
    setIsMassDeleteOpen(false);
  }, [selectedIds, orders, deleteOrder, currentUser, setSelectedIds]);

  return {
    isBulkEditOpen, setIsBulkEditOpen,
    bulkField, setBulkField,
    bulkValue, setBulkValue,
    bulkStatusReason, setBulkStatusReason,
    bulkStatusReasonNote, setBulkStatusReasonNote,
    isMassDeleteOpen, setIsMassDeleteOpen,
    resetBulkEditor,
    handleBulkUpdate,
    handleMassDelete,
    confirmMassDelete,
  };
}
