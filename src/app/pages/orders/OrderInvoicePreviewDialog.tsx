import React from 'react';
import { FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { DEFAULT_WARRANTY_TEXT, getOrderInvoiceHtml, OrderInvoiceContext, printOrderInvoice, printOrderInvoiceHtml } from './orderInvoice';

interface OrderInvoicePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  context: OrderInvoiceContext | null;
}

export function OrderInvoicePreviewDialog({ isOpen, onClose, context }: OrderInvoicePreviewDialogProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [includeWarranty, setIncludeWarranty] = React.useState(false);
  const [warrantyText, setWarrantyText] = React.useState('');

  React.useEffect(() => {
    if (!isOpen) {
      setIncludeWarranty(false);
      setWarrantyText('');
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (includeWarranty && !warrantyText.trim()) {
      setWarrantyText(DEFAULT_WARRANTY_TEXT);
    }
  }, [includeWarranty, warrantyText]);

  const invoiceHtml = React.useMemo(
    () => (
      context
        ? getOrderInvoiceHtml(context, { includeWarranty, warrantyText })
        : ''
    ),
    [context, includeWarranty, warrantyText],
  );

  const handlePrint = () => {
    try {
      if (includeWarranty && !warrantyText.trim()) {
        toast.error('Isi teks garansi dulu atau matikan opsi garansi.');
        return;
      }

      const frameWindow = iframeRef.current?.contentWindow;

      if (frameWindow) {
        frameWindow.focus();
        frameWindow.print();
        return;
      }

      if (context) {
        printOrderInvoice(context, { includeWarranty, warrantyText });
        return;
      }

      printOrderInvoiceHtml(invoiceHtml);
    } catch (error: any) {
      toast.error(error?.message || 'Gagal mencetak kwitansi');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <span>Preview Kwitansi</span>
          {context?.order && (
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-sm font-mono text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              #{context.order.id}
            </span>
          )}
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Preview kwitansi mengikuti data pesanan aktif. Cek dulu sebelum dicetak.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 text-white hover:bg-blue-700">
              <Printer className="mr-2 h-4 w-4" />
              Cetak Kwitansi
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          Kwitansi ditampilkan dulu di sini supaya bisa direview sebelum masuk ke dialog print browser.
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Switch
                  id="toggle-warranty"
                  checked={includeWarranty}
                  onCheckedChange={setIncludeWarranty}
                />
                <label htmlFor="toggle-warranty" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Tampilkan Garansi
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aktifkan kalau kwitansi ini perlu menyertakan catatan atau ketentuan garansi.
              </p>
            </div>
          </div>

          {includeWarranty && (
            <div className="mt-4 space-y-2">
              <label htmlFor="warranty-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Isi Garansi
              </label>
              <Textarea
                id="warranty-text"
                value={warrantyText}
                onChange={(event) => setWarrantyText(event.target.value)}
                placeholder={DEFAULT_WARRANTY_TEXT}
                className="min-h-[96px] bg-slate-50 dark:bg-slate-950"
              />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
          {context ? (
            <iframe
              ref={iframeRef}
              title={`Kwitansi ${context.order.id}`}
              srcDoc={invoiceHtml}
              className="h-[72vh] w-full bg-white"
            />
          ) : (
            <div className="flex h-[72vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Data kwitansi tidak tersedia.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
