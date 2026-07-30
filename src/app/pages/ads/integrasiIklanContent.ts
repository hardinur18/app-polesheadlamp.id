export const integrasiIklanCopy = {
  badge: 'Integrasi Iklan',
  secondaryBadges: ['Meta + Google Ads Live', 'Hanya akun API yang terceklis'],
  title: 'Integrasi Iklan Multi-Platform',
  description:
    'Halaman ini menyatukan spend live, burn, dan breakdown order per akun iklan. Istilah dan hitungan di fitur ini dijaga konsisten dengan Monitoring Perf. untuk lane Meta dan Google.',
  heroHighlights: {
    coverage: {
      label: 'Cakupan',
      description: 'Meta dan Google digabung dalam satu panel baca dan aksi.',
    },
    history: {
      label: 'Histori Cepat',
      description: 'Kemarin ke belakang dibaca dari snapshot database 90 hari.',
    },
    today: {
      label: 'Hari Ini',
      description: 'Data hari ini lewat live cache server, bukan raw API tiap render.',
    },
  },
  filters: {
    title: 'Kontrol Filter',
    platform: 'Pilih Platform',
    businessGroup: 'Pilih Business Manager / Grup',
    advertiser: 'Pilih Advertiser',
    adAccount: 'Pilih Akun Iklan',
    allPlatform: 'Semua Platform',
    allBusinessGroup: 'Semua Business Manager / Grup',
    allAdvertiser: 'Semua Advertiser',
    allAdAccount: 'Semua Akun',
  },
  summaries: {
    spend: {
      label: 'Total Spend',
      description: 'Biaya iklan live yang dibaca langsung dari platform.',
    },
    burn: {
      label: 'Total Burn',
      description:
        'Spend ditambah komponen PPN dan fee akun iklan sesuai konfigurasi master data.',
    },
    leads: {
      label: 'Order Terbaca',
      description:
        'Prioritas pertama memakai order masuk harian berdasarkan created_at agar sama dengan Monitoring Perf. Jika satu akun belum punya atribusi order, sistem baru memakai leads dashboard manual sebagai cadangan.',
    },
    clicks: {
      label: 'Clicks',
      description: 'Klik live yang dibaca langsung dari platform iklan.',
    },
  },
  sourceLegend: [
    {
      label: 'Live API',
      tone: 'emerald',
      description: 'Spend, clicks, CTR, dan metrik media dibaca langsung dari Meta atau Google.',
    },
    {
      label: 'Dashboard Manual',
      tone: 'amber',
      description: 'Dipakai hanya sebagai cadangan jika order akun tersebut belum berhasil terbaca dari mapping operasional.',
    },
    {
      label: 'order',
      tone: 'blue',
      description: 'Order masuk berhasil dipetakan exact ke satu akun iklan.',
    },
    {
      label: 'order*',
      tone: 'indigo',
      description:
        'Order masuk belum exact ke satu akun, lalu dibagi proporsional dalam advertiser/platform yang sama.',
    },
  ],
  table: {
    title: 'Data Integrasi Iklan',
    empty: 'Belum ada data ads untuk filter yang dipilih.',
    columns: {
      platform: {
        label: 'Platform',
        description: 'Sumber live data akun iklan, misalnya Meta atau Google.',
      },
      businessGroup: {
        label: 'Business Manager / Grup',
        description:
          'BM live untuk Meta atau grup manager/customer group untuk Google Ads.',
      },
      account: {
        label: 'Akun',
        description: 'Nama akun iklan live yang dipetakan ke master data internal.',
      },
      advertiser: {
        label: 'Advertiser',
        description: 'PIC advertiser internal yang bertanggung jawab atas akun tersebut.',
      },
      spend: {
        label: 'Spend',
        description: 'Biaya iklan live pada rentang waktu aktif.',
      },
      burn: {
        label: 'Burn',
        description: 'Spend + PPN + fee akun iklan pada rentang waktu aktif.',
      },
      leads: {
        label: 'Order',
        description:
          'Jumlah order masuk yang terbaca untuk akun tersebut. Jika akun belum punya mapping order yang aman, sistem memakai leads dashboard manual sebagai cadangan.',
      },
      clicks: {
        label: 'Clicks',
        description: 'Total klik live pada rentang waktu aktif.',
      },
      ctr: {
        label: 'CTR',
        description: 'Persentase klik dibanding impresi live.',
      },
      cpl: {
        label: 'CPL',
        description:
          'Spend dibagi leads/order terbaca. Jika tidak ada input atau fallback, nilai tidak ditampilkan.',
      },
    },
  },
} as const;

export const integrasiIklanGlossary = [
  {
    term: 'Business Manager / Grup',
    description:
      'Kelompok akun live. Untuk Meta tampil sebagai BM, untuk Google tampil sebagai grup manager.',
  },
  {
    term: 'Spend',
    description: 'Biaya iklan live yang dibaca langsung dari platform pada rentang aktif.',
  },
  {
    term: 'Burn',
    description:
      'Total spend yang sudah ditambah PPN dan fee sesuai pengaturan akun iklan di master data.',
  },
  {
    term: 'Order Terbaca',
    description:
      'Nilai utama fitur ini. Prioritas pertama memakai order masuk harian berdasarkan created_at. Jika belum ada mapping order yang aman, sistem memakai leads dashboard sebagai cadangan.',
  },
  {
    term: 'order',
    description:
      'Order berhasil dipetakan exact ke satu akun iklan lewat advertiser, platform, subchannel, dan CS.',
  },
  {
    term: 'order*',
    description:
      'Order belum punya atribusi akun yang 100% presisi, lalu dibagi proporsional di dalam advertiser/platform yang sama supaya total tidak hilang.',
  },
  {
    term: 'CPL',
    description:
      'Cost per lead, dihitung dari spend dibagi leads/order terbaca pada rentang aktif.',
  },
  {
    term: 'Monitoring Perf.',
    description:
      'Patokan order harian untuk fitur ini. Basis tanggal yang dipakai sama, yaitu created_at order masuk.',
  },
] as const;
