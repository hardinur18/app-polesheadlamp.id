import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import { WhatsAppComingSoon } from './components/whatsappModuleShared';

export function WhatsAppAnalyticsPage() {
  return (
    <WhatsAppModuleFrame activeId="whatsapp-analytics">
      <WhatsAppComingSoon
        title="Analytics WhatsApp"
        description="Analisa volume percakapan, waktu respon CS, dan kontribusi tiap nomor/provider WhatsApp per periode untuk membaca kesehatan channel."
        capabilities={[
          'Tren percakapan masuk & keluar per hari (WIB)',
          'Waktu respon pertama dan waktu penyelesaian',
          'Perbandingan provider Kirimdev vs Meta langsung',
          'Ekspor ringkasan untuk laporan operasional',
        ]}
      />
    </WhatsAppModuleFrame>
  );
}
