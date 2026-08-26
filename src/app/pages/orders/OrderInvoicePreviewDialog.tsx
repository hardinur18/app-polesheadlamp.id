import React from 'react';
import { FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Dialog, DialogFooter } from '../../components/ui/dialog';
import {
  MasterDataDialogBody,
  MasterDataFormDialogContent,
  MasterDataFormHeader,
} from '../../components/ui/master-data-ui';
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <MasterDataFormDialogContent size="wide" className="orderInvoicePreviewDialog">
        <MasterDataFormHeader
          icon={FileText}
          title={
            <span className="orderInvoicePreviewTitle">
              <span>Preview Kwitansi</span>
              {context?.order && (
                <span
                  className="orderInvoicePreviewOrderId"
                  title="ID order kwitansi"
                >
                  #{context.order.id}
                </span>
              )}
            </span>
          }
          description="Review kwitansi sebelum masuk ke dialog print browser."
        />

        <MasterDataDialogBody compact className="orderInvoicePreviewBody">
          <div className="orderInvoicePreviewNotice">
            Kwitansi ditampilkan dulu di sini supaya bisa direview sebelum masuk ke dialog print browser.
          </div>

          <section className="orderInvoiceWarrantyPanel">
            <div className="orderInvoiceWarrantyHeader">
              <Switch
                id="toggle-warranty"
                checked={includeWarranty}
                onCheckedChange={setIncludeWarranty}
              />
              <div className="orderInvoiceWarrantyCopy">
                <label htmlFor="toggle-warranty">
                  Tampilkan Garansi
                </label>
                <p>
                  Aktifkan kalau kwitansi ini perlu menyertakan catatan atau ketentuan garansi.
                </p>
              </div>
            </div>

            {includeWarranty && (
              <div className="orderInvoiceWarrantyInput">
                <label htmlFor="warranty-text">
                  Isi Garansi
                </label>
                <Textarea
                  id="warranty-text"
                  value={warrantyText}
                  onChange={(event) => setWarrantyText(event.target.value)}
                  placeholder={DEFAULT_WARRANTY_TEXT}
                  className="orderInvoiceWarrantyTextarea"
                />
              </div>
            )}
          </section>

          <section className="orderInvoiceFramePanel">
            {context ? (
              <iframe
                ref={iframeRef}
                title={`Kwitansi ${context.order.id}`}
                srcDoc={invoiceHtml}
                className="orderInvoiceFrame"
              />
            ) : (
              <div className="orderInvoiceEmptyState">
                Data kwitansi tidak tersedia.
              </div>
            )}
          </section>
        </MasterDataDialogBody>

        <DialogFooter className="masterDataFormActions orderInvoicePreviewFooter">
          <div className="orderInvoicePreviewFooterInner">
            <p>Preview kwitansi mengikuti data pesanan aktif. Cek dulu sebelum dicetak.</p>
            <div className="orderInvoicePreviewFooterActions">
              <Button variant="outline" onClick={onClose}>
                Tutup
              </Button>
              <Button onClick={handlePrint} disabled={!context} className="bg-blue-600 text-white hover:bg-blue-700">
                <Printer className="h-4 w-4" />
                Cetak Kwitansi
              </Button>
            </div>
          </div>
        </DialogFooter>
      </MasterDataFormDialogContent>
    </Dialog>
  );
}
