import { WhatsAppModuleFrame } from './components/WhatsAppModuleFrame';
import { WhatsAppComingSoon } from './components/whatsappModuleShared';

export function WhatsAppStoragePage() {
  return (
    <WhatsAppModuleFrame activeId="whatsapp-storage">
      <WhatsAppComingSoon
        title="Storage media WhatsApp"
        description="Kelola media dan lampiran WhatsApp (gambar, dokumen, audio, video) yang diterima dari pelanggan, termasuk media yang dihosting Kirimdev."
        capabilities={[
          'Galeri media per percakapan dan per kontak',
          'Pratinjau aman tanpa membuka kredensial Meta',
          'Tautan media permanen dari enrichment Kirimdev',
          'Kebijakan retensi dan pembersihan media',
        ]}
      />
    </WhatsAppModuleFrame>
  );
}
