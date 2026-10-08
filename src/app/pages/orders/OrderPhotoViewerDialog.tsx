import React from 'react';
import { Camera, FileUp, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Upload } from '../../components/ui/Upload';
import type { Order } from '../master-data/data';
import {
  ORDER_DOCUMENTATION_ITEMS,
  ORDER_PHOTO_INITIAL_LIMIT,
  OrderDocumentationImage,
  getOrderPhotoUrls,
  type OrderDocumentationKey,
} from './orderDocumentation';

type OrderPhotoViewerDialogProps = {
  order: Order | null;
  tab: OrderDocumentationKey;
  onTabChange: (tab: OrderDocumentationKey) => void;
  expandedTabs: Partial<Record<OrderDocumentationKey, boolean>>;
  onExpandTab: (tab: OrderDocumentationKey) => void;
  onClose: () => void;
  canUploadPaymentProof: boolean;
  uploadedFiles: File[];
  onUploadedFilesChange: (files: File[]) => void;
  isUploading: boolean;
  onSavePaymentProof: () => void;
};

const getEmptyPhotoLabel = (type: OrderDocumentationKey) => {
  if (type === 'payment') return 'bukti pembayaran';
  if (type === 'before') return 'sebelum pengerjaan';
  if (type === 'after') return 'setelah pengerjaan';
  return 'bukti tanda tangan';
};

export function OrderPhotoViewerDialog({
  order,
  tab,
  onTabChange,
  expandedTabs,
  onExpandTab,
  onClose,
  canUploadPaymentProof,
  uploadedFiles,
  onUploadedFilesChange,
  isUploading,
  onSavePaymentProof,
}: OrderPhotoViewerDialogProps) {
  return (
    <Modal
      isOpen={!!order}
      onClose={onClose}
      title="Dokumentasi Pekerjaan"
      size="lg"
      className="orderPhotoDialog"
      preventOutsideClose
    >
      {order && (
        <div className="orderPhotoViewer flex flex-col">
          <Tabs
            value={tab}
            onValueChange={(value) => onTabChange(value as OrderDocumentationKey)}
            className="w-full flex-1 flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-slate-100 dark:bg-slate-800 p-1">
              <TabsTrigger value="before" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">
                Sebelum ({getOrderPhotoUrls(order, 'before').length})
              </TabsTrigger>
              <TabsTrigger value="after" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">
                Sesudah ({getOrderPhotoUrls(order, 'after').length})
              </TabsTrigger>
              <TabsTrigger value="payment" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">
                Bayar ({getOrderPhotoUrls(order, 'payment').length === 0 && (order.photos as any)?.paymentDeleted ? <span className="text-red-500 font-medium">Dihapus</span> : getOrderPhotoUrls(order, 'payment').length})
              </TabsTrigger>
              <TabsTrigger value="signature" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1">
                TTD ({getOrderPhotoUrls(order, 'signature').length})
              </TabsTrigger>
            </TabsList>

            {ORDER_DOCUMENTATION_ITEMS.map((item) => {
              const type = item.key;
              const urls = getOrderPhotoUrls(order, type);
              const isExpanded = Boolean(expandedTabs[type]);
              const visibleUrls = isExpanded ? urls : urls.slice(0, ORDER_PHOTO_INITIAL_LIMIT);
              const hiddenCount = Math.max(0, urls.length - visibleUrls.length);

              return (
                <TabsContent key={type} value={type} className="orderPhotoTabContent flex-1 min-h-0 p-1">
                  {urls.length > 0 ? (
                    <>
                      <div className={`grid gap-4 pb-4 ${type === 'payment' || type === 'signature' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                        {visibleUrls.map((url: string, idx: number) => (
                          <OrderDocumentationImage
                            key={`${type}-${url}-${idx}`}
                            src={url}
                            alt={`${item.label} ${idx + 1}`}
                            priority={idx < 2}
                          />
                        ))}
                      </div>
                      {hiddenCount > 0 && (
                        <div className="pb-4 text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onExpandTab(type)}
                          >
                            Tampilkan {hiddenCount} foto lagi
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mb-4">
                      {type === 'payment' && (order.photos as any)?.paymentDeleted ? (
                        <>
                          <Trash2 className="w-12 h-12 mb-3 text-red-400 opacity-50" />
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Bukti pembayaran telah dihapus</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Dihapus pada {(order.photos as any)?.paymentDeletedAt ? new Date((order.photos as any).paymentDeletedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : 'sistem'}
                          </p>
                        </>
                      ) : (
                        <>
                          <Camera className="w-12 h-12 mb-2 opacity-20 text-slate-400" />
                          <p className="text-sm text-slate-400">Tidak ada foto {getEmptyPhotoLabel(type)}</p>
                        </>
                      )}
                    </div>
                  )}

                  {type === 'payment' && canUploadPaymentProof && (
                    <div className="orderPhotoPaymentUpload mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="font-bold text-sm mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <FileUp className="w-4 h-4" />
                        Upload Bukti Pembayaran
                      </h4>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Upload
                          label="Pilih foto bukti transfer/pembayaran"
                          accept="image/*"
                          multiple={true}
                          maxFiles={3}
                          onChange={onUploadedFilesChange}
                          preview={true}
                        />
                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            onClick={onSavePaymentProof}
                            disabled={isUploading || uploadedFiles.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileUp className="w-4 h-4 mr-2" />}
                            {isUploading ? 'Mengupload...' : 'Simpan Foto'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}
    </Modal>
  );
}
