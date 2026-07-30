import brandIcon from '@/assets/polesheadlamp-app-logo-round.png?inline';
import brandWordmark from '../../../../File PNG/Polesheadlamp.id (1).png?inline';
import { Area, Branch, Order, PaymentMethod, Platform, ServiceType, SubChannel, User, VehicleType } from '../master-data/data';

export type OrderInvoiceContext = {
  order: Order;
  service?: ServiceType;
  vehicle?: VehicleType;
  branch?: Branch;
  area?: Area;
  cs?: User;
  advertiser?: User;
  technician?: User;
  paymentMethod?: PaymentMethod;
  platform?: Platform;
  subChannel?: SubChannel;
};

export type OrderInvoiceOptions = {
  includeWarranty?: boolean;
  warrantyText?: string;
};

export const DEFAULT_WARRANTY_TEXT = 'Garansi 2 bulan.';

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
});

const orderStatusLabels: Record<string, string> = {
  pending: 'Menunggu',
  processing: 'Diproses',
  waiting: 'Terjadwal',
  otw: 'OTW',
  working: 'Sedang Dikerjakan',
  teknisi_completed: 'Selesai Teknisi',
  qc: 'QC',
  done: 'Selesai',
  cancelled: 'Batal',
  reschedule: 'Jadwal Ulang',
};

const paymentStatusLabels: Record<string, string> = {
  Unpaid: 'Belum Bayar',
  'Down Payment': 'DP',
  Paid: 'Lunas',
};

const DEFAULT_SIGNATURE_NAME = 'Muhammad Avit';
const DEFAULT_SIGNATURE_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 100" fill="none">
    <path d="M70 12 L69 70" stroke="#111111" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M84 16 C80 30 79 48 80 72" stroke="#111111" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M94 13 C95 34 92 57 90 76" stroke="#111111" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M60 66 C66 50 72 42 79 63 C82 71 85 75 89 75 C97 74 103 58 107 44" stroke="#111111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M88 73 C99 79 111 79 122 72" stroke="#111111" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M107 31 C103 48 101 60 102 79" stroke="#111111" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M118 49 C123 46 129 49 132 56 C135 64 131 72 122 77" stroke="#111111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M61 86 C75 88 92 87 109 84 C118 83 127 81 135 78" stroke="#111111" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
`)}`;
const WHATSAPP_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M20.52 3.48A11.8 11.8 0 0 0 12.08 0C5.53 0 .2 5.33.2 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.33-1.66a11.8 11.8 0 0 0 5.75 1.47h.01c6.54 0 11.88-5.33 11.9-11.9a11.8 11.8 0 0 0-3.47-8.43Zm-8.44 18.3h-.01a9.86 9.86 0 0 1-5.02-1.37l-.36-.21-3.75.98 1-3.66-.23-.37a9.86 9.86 0 0 1-1.5-5.25C2.2 6.45 6.64 2 12.08 2c2.63 0 5.1 1.03 6.97 2.9a9.8 9.8 0 0 1 2.9 7c-.02 5.44-4.46 9.88-9.87 9.88Zm5.4-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.17-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.47-1.76-1.64-2.06-.18-.3-.02-.46.13-.6.13-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.28.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.14.2 2.1 3.2 5.08 4.49.71.3 1.26.48 1.7.62.71.23 1.36.2 1.87.12.58-.08 1.76-.72 2.01-1.42.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/>
  </svg>
`;
const INSTAGRAM_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.8A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95h-8.5Zm8.86 1.35a1.09 1.09 0 1 1 0 2.18 1.09 1.09 0 0 1 0-2.18ZM12 6.85A5.15 5.15 0 1 1 6.85 12 5.16 5.16 0 0 1 12 6.85Zm0 1.8A3.35 3.35 0 1 0 15.35 12 3.35 3.35 0 0 0 12 8.65Z"/>
  </svg>
`;

const escapeHtml = (value?: string | number | null) => {
  const text = value === undefined || value === null || value === '' ? '-' : String(value);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatMultilineHtml = (value?: string | number | null) => (
  escapeHtml(value).replace(/\n/g, '<br />')
);

const formatDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleDateString('id-ID', options || {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (error) {
    return value;
  }
};

const formatCurrency = (value?: number) => currencyFormatter.format(value || 0);

const resolveSignatureUrl = (order: Order) => {
  const signature = order.photos?.signature;

  if (!signature) return undefined;
  if (Array.isArray(signature)) return signature[0];
  return signature;
};

const buildFieldRow = (label: string, value: string, className = '') => `
  <div class="field-row ${className}">
    <div class="field-label">${escapeHtml(label)}</div>
    <div class="field-separator">:</div>
    <div class="field-value">${escapeHtml(value)}</div>
  </div>
`;

const buildFieldRowHtml = (label: string, valueHtml: string, className = '') => `
  <div class="field-row ${className}">
    <div class="field-label">${escapeHtml(label)}</div>
    <div class="field-separator">:</div>
    <div class="field-value">${valueHtml}</div>
  </div>
`;

const buildInvoiceHtml = ({
  order,
  service,
  vehicle,
  branch,
  area,
  cs,
  advertiser,
  technician,
  paymentMethod,
  platform,
  subChannel,
}: OrderInvoiceContext, options: OrderInvoiceOptions = {}) => {
  const {
    includeWarranty = false,
    warrantyText = '',
  } = options;
  const issueDate = new Date();
  const issueDateText = issueDate.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const issueTimeText = issueDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const serviceDateText = formatDate(order.serviceDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const vehicleDescription = [vehicle?.name, vehicle?.category ? `(${vehicle.category})` : undefined]
    .filter(Boolean)
    .join(' ')
    || '-';
  const complaintText = order.notes?.trim()
    || service?.name
    || order.serviceCategory
    || '-';
  const scheduleLine = `${serviceDateText}${order.serviceTime ? ` | ${order.serviceTime}` : ''}`;
  const branchLine = [branch?.name, area?.name].filter(Boolean).join(' - ') || '-';
  const receiptStatus = paymentStatusLabels[order.paymentStatus] || order.paymentStatus || '-';
  const signatureUrl = resolveSignatureUrl(order) || DEFAULT_SIGNATURE_URL;
  const signatureName = DEFAULT_SIGNATURE_NAME;
  const normalizedWarrantyText = warrantyText.trim() || DEFAULT_WARRANTY_TEXT;

  return `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kwitansi ${escapeHtml(order.id)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #efefef;
        --paper: #f7f7f7;
        --ink: #161616;
        --muted: #4b4b4b;
        --line: #242424;
        --soft-line: #8e8e8e;
        --brand-yellow: #ffd400;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: var(--bg);
        color: var(--ink);
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      }

      body {
        padding: 24px 16px;
      }

      .page {
        width: 100%;
        max-width: 820px;
        margin: 0 auto;
        background: var(--paper);
        padding: 26px 28px 34px;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .brand {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
        min-width: 0;
      }

      .brand-logo-shell {
        width: 100%;
        max-width: 360px;
        height: 44px;
        overflow: hidden;
      }

      .brand-logo {
        width: 457px;
        height: 92px;
        display: block;
        max-width: none;
        margin-left: -49px;
        margin-top: -18px;
      }

      .brand-name {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: #1f1f1f;
      }

      .brand-tagline {
        font-size: 10px;
        letter-spacing: 0.42em;
        color: var(--brand-yellow);
        text-transform: uppercase;
      }

      .brand-contact {
        font-size: 12px;
        line-height: 1.55;
        color: #2d2d2d;
      }

      .brand-contact .muted {
        color: var(--muted);
      }

      .contact-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 18px;
        align-items: center;
      }

      .contact-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .contact-icon {
        width: 14px;
        height: 14px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .contact-icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      .contact-icon.whatsapp {
        color: #25d366;
      }

      .contact-icon.instagram {
        color: #d62976;
      }

      .brand-mark {
        width: 68px;
        height: 68px;
        flex: 0 0 68px;
        object-fit: contain;
        margin-top: 6px;
        margin-right: 8px;
      }

      .divider {
        margin: 10px 0 18px;
        border-top: 3px double var(--line);
      }

      .title {
        text-align: center;
        font-family: Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif;
        font-size: 46px;
        line-height: 1;
        letter-spacing: -0.04em;
        margin: 6px 0 28px;
      }

      .fields {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .section-gap {
        margin-top: 26px;
      }

      .field-row {
        display: grid;
        grid-template-columns: 195px 20px minmax(0, 1fr);
        align-items: start;
        gap: 0;
        font-size: 13px;
        line-height: 1.55;
      }

      .field-label {
        font-weight: 700;
      }

      .field-label.emphasis {
        font-size: 15px;
      }

      .field-label.italic {
        font-style: italic;
      }

      .field-separator {
        font-weight: 700;
        text-align: center;
      }

      .field-value {
        min-height: 24px;
        padding: 1px 4px 3px 4px;
        border-bottom: 1px dotted var(--soft-line);
        word-break: break-word;
      }

      .address-row .field-value {
        min-height: 52px;
      }

      .payment-row .field-label,
      .payment-row .field-value {
        font-size: 15px;
        font-weight: 700;
      }

      .warranty-row .field-value {
        min-height: 64px;
        line-height: 1.65;
        white-space: normal;
      }

      .meta-note {
        margin-top: 14px;
        font-size: 11px;
        color: var(--muted);
        line-height: 1.6;
      }

      .footer {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-end;
        margin-top: 54px;
      }

      .thanks {
        font-size: 13px;
        font-weight: 700;
        font-style: italic;
      }

      .signature {
        min-width: 220px;
        text-align: center;
      }

      .signature-title {
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .signature-image-wrap {
        height: 86px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        margin-bottom: 6px;
      }

      .signature-image {
        max-width: 120px;
        max-height: 82px;
        object-fit: contain;
      }

      .signature-line {
        width: 150px;
        border-top: 1px solid var(--line);
        margin: 0 auto 6px;
      }

      .signature-name {
        font-size: 13px;
      }

      @page {
        size: A4;
        margin: 10mm;
      }

      @media (max-width: 720px) {
        body {
          padding: 0;
        }

        .page {
          padding: 18px 16px 24px;
          box-shadow: none;
        }

        .header,
        .footer {
          flex-direction: column;
          align-items: stretch;
        }

        .brand-mark {
          margin-top: 0;
          margin-right: 0;
        }

        .contact-row {
          gap: 6px 12px;
        }

        .brand-logo-shell {
          max-width: 300px;
          height: 38px;
        }

        .brand-logo {
          width: 380px;
          height: 76px;
          margin-left: -41px;
          margin-top: -15px;
        }

        .field-row {
          grid-template-columns: 120px 16px minmax(0, 1fr);
          font-size: 12px;
        }

        .title {
          font-size: 38px;
          margin-bottom: 22px;
        }

        .signature {
          width: 220px;
          max-width: 100%;
          align-self: flex-end;
          text-align: center;
        }

        .signature-image-wrap {
          justify-content: center;
        }

        .signature-line {
          margin-left: auto;
          margin-right: auto;
        }
      }

      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }

        .page {
          max-width: none;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div class="brand">
          <div class="brand-logo-shell">
            <img src="${brandWordmark}" alt="Restoration Headlamp Indonesia" class="brand-logo" />
          </div>
          <div class="brand-contact">
            <div>Palasari, Kabupaten Bogor, Jawa Barat</div>
            <div class="muted">Restoration Headlamp Indonesia</div>
            <div class="contact-row">
              <span class="contact-item">
                <span class="contact-icon whatsapp">${WHATSAPP_ICON}</span>
                <span>089 8801 5336</span>
              </span>
              <span class="contact-item">
                <span class="contact-icon instagram">${INSTAGRAM_ICON}</span>
                <span>@restorationheadlamp</span>
              </span>
            </div>
          </div>
        </div>
        <img src="${brandIcon}" alt="Logo Restoration Headlamp Indonesia" class="brand-mark" />
      </div>

      <div class="divider"></div>
      <div class="title">Kwitansi</div>

      <div class="fields">
        ${buildFieldRow('Tanggal/Jam', `${issueDateText}, ${issueTimeText}`)}
        ${buildFieldRow('Nomor Kwitansi', order.id)}
        ${buildFieldRow('Nama', order.customerName)}
        ${buildFieldRow('Tipe Mobil', vehicleDescription)}
        ${buildFieldRow('Alamat', order.address, 'address-row')}
        ${buildFieldRow('Jumlah Pembayaran', formatCurrency(order.price), 'payment-row')}
        ${buildFieldRow('Kendala', complaintText)}
      </div>

      <div class="fields section-gap">
        ${buildFieldRow('Jadwal Service', scheduleLine)}
        ${buildFieldRow('Area', branchLine)}
        ${buildFieldRow('Status Pembayaran', receiptStatus)}
      </div>

      ${includeWarranty
        ? `<div class="fields section-gap">
        ${buildFieldRowHtml('Garansi', formatMultilineHtml(normalizedWarrantyText), 'warranty-row')}
      </div>`
        : ''}

      <div class="meta-note">
        Dokumen ini dibuat dari data pesanan aktif. Mohon cek ulang nominal, metode pembayaran, dan jadwal layanan sebelum dibagikan atau dicetak.
      </div>

      <div class="footer">
        <div class="thanks">Terima kasih atas pembayaran Anda.</div>

        <div class="signature">
          <div class="signature-title">Tanda Tangan,</div>
          <div class="signature-image-wrap">
            ${signatureUrl
              ? `<img src="${escapeHtml(signatureUrl)}" alt="Tanda tangan" class="signature-image" />`
              : ''}
          </div>
          <div class="signature-line"></div>
          <div class="signature-name">[ ${escapeHtml(signatureName)} ]</div>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

export const getOrderInvoiceHtml = (context: OrderInvoiceContext, options: OrderInvoiceOptions = {}) => buildInvoiceHtml(context, options);

export const printOrderInvoiceHtml = (invoiceHtml: string) => {
  const printWindow = window.open('', '_blank', 'width=1024,height=900');

  if (!printWindow) {
    throw new Error('Popup cetak diblokir browser. Izinkan pop-up lalu coba lagi.');
  }

  printWindow.document.open();
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    }, 300);
  };

  if (printWindow.document.readyState === 'complete') {
    triggerPrint();
  } else {
    printWindow.onload = triggerPrint;
  }
};

export const printOrderInvoice = (context: OrderInvoiceContext, options: OrderInvoiceOptions = {}) => {
  printOrderInvoiceHtml(buildInvoiceHtml(context, options));
};
