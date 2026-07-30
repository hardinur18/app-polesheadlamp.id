import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import {
  CreditCard, Eye, EyeOff, Save, Loader2, Copy, Check,
  ShieldCheck, Globe, Building2, Wallet, AlertTriangle, RefreshCcw, BookOpen
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useMasterData } from '@/app/pages/master-data/context';
import { usePermissions } from '@/app/hooks/usePermissions';
import { getPaymentGatewayNotice, orderPaymentService, type PaymentGatewayServiceStatus } from '@/app/services/orderPaymentService';
import { logActivity } from '@/app/services/auditService';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { cn } from '@/app/components/ui/utils';

const KV_TABLE = 'kv_store_f781cd00';
const SETTINGS_KEY = 'payment_gateway:settings';

interface PaymentGatewayConfig {
  enabled: boolean;
  merchantName: string;
  xenditSecretKey: string;
  xenditWebhookToken: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  updatedAt: string;
}

const DEFAULT_CONFIG: PaymentGatewayConfig = {
  enabled: false,
  merchantName: '',
  xenditSecretKey: '',
  xenditWebhookToken: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: '',
  updatedAt: '',
};

const CARD = 'rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800';

export const PaymentGatewaySettings: React.FC = () => {
  const { currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('finance.manage');

  const [config, setConfig] = useState<PaymentGatewayConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<PaymentGatewayServiceStatus | null>(null);
  const [checkingService, setCheckingService] = useState(true);

  const webhookUrl = buildMakeServerUrl('/payments/webhook/xendit');

  useEffect(() => {
    fetchConfig();
    checkServiceStatus();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(KV_TABLE)
        .select('value')
        .eq('key', SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        setConfig({ ...DEFAULT_CONFIG, ...data.value });
      }
    } catch (err: any) {
      console.error('Failed to load payment gateway config:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkServiceStatus = async () => {
    setCheckingService(true);
    try {
      const status = await orderPaymentService.getServiceStatus();
      setServiceStatus(status);
    } finally {
      setCheckingService(false);
    }
  };

  const handleSave = async () => {
    if (!canManage) return;

    setSaving(true);
    try {
      const payload = {
        ...config,
        updatedAt: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(KV_TABLE)
        .upsert({
          key: SETTINGS_KEY,
          value: payload,
        });

      if (error) throw error;

      setConfig(payload);
      toast.success('Pengaturan Payment Gateway berhasil disimpan');
      await checkServiceStatus();

      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE',
          'Payment Gateway',
          `Memperbarui pengaturan Payment Gateway (${config.enabled ? 'Aktif' : 'Nonaktif'})`,
          ''
        );
      }
    } catch (err: any) {
      toast.error('Pengaturan Payment Gateway belum berhasil disimpan', {
        description: 'Silakan coba lagi. Jika kendala berlanjut, periksa koneksi server atau hubungi admin.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Webhook URL berhasil disalin');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.xenditSecretKey) {
      toast.error('Masukkan API Key terlebih dahulu', {
        description: 'Secret API Key dibutuhkan agar sistem bisa menghubungkan payment gateway ke Xendit.',
      });
      return;
    }

    setTesting(true);
    try {
      const data = await orderPaymentService.testXenditConnection(config.xenditSecretKey);
      toast.success(`Koneksi berhasil! Saldo: Rp ${Number(data.balance || 0).toLocaleString('id-ID')}`);
    } catch (err) {
      const notice = getPaymentGatewayNotice(err, {
        title: 'Koneksi ke Xendit belum berhasil',
        description: 'Periksa kembali secret key yang dipakai atau coba beberapa saat lagi.',
      });
      toast.error(notice.title, { description: notice.description });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-orange-500" />
            Payment Gateway
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Konfigurasi integrasi pembayaran QRIS via Xendit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs"
          >
            <BookOpen className="h-3.5 w-3.5 mr-1.5" />
            Panduan Setup
          </Button>
          <Badge
            variant="outline"
            className={cn(
              'text-xs px-3 py-1',
              config.enabled
                ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                : 'bg-slate-50 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
            )}
          >
            {config.enabled ? 'Aktif' : 'Nonaktif'}
          </Badge>
        </div>
      </div>

      {checkingService ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memeriksa kesiapan layanan QRIS di server...
        </div>
      ) : serviceStatus ? (
        <Alert
          className={cn(
            serviceStatus.state === 'live' && 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-100',
            serviceStatus.state === 'mock' && 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
            serviceStatus.state === 'disabled' && 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
            serviceStatus.state === 'unavailable' && 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100',
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{serviceStatus.title}</AlertTitle>
          <AlertDescription>
            <p>{serviceStatus.description}</p>
            {serviceStatus.state === 'unavailable' && (
              <p className="text-xs text-red-700/80 dark:text-red-200/80">
                Halaman ini sudah menyimpan konfigurasi, tetapi route pembayaran di server production belum bisa dijangkau oleh aplikasi.
              </p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Setup Guide (collapsible) */}
      {showGuide && (
        <Card className={CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-500" />
              Panduan Setup Payment Gateway
            </CardTitle>
            <CardDescription>Ikuti langkah-langkah berikut untuk mengaktifkan pembayaran QRIS</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  A. Mendapatkan API Key Xendit
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600 dark:text-slate-400 ml-1">
                  <li>Buka <a href="https://dashboard.xendit.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">dashboard.xendit.co</a> dan login / daftar akun</li>
                  <li>Klik menu <span className="font-medium text-slate-800 dark:text-slate-200">Settings</span> di sidebar kiri</li>
                  <li>Pilih tab <span className="font-medium text-slate-800 dark:text-slate-200">Developers</span> &rarr; <span className="font-medium text-slate-800 dark:text-slate-200">API Keys</span></li>
                  <li>Klik <span className="font-medium text-slate-800 dark:text-slate-200">Generate Secret Key</span> (pilih mode <span className="text-amber-600">Development</span> untuk testing atau <span className="text-green-600">Production</span> untuk live)</li>
                  <li>Copy Secret Key, lalu paste di kolom <span className="font-medium text-slate-800 dark:text-slate-200">Secret API Key</span> di bawah</li>
                  <li>Klik tombol <span className="font-medium text-slate-800 dark:text-slate-200">Test</span> untuk memastikan koneksi berhasil</li>
                </ol>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  B. Setting Webhook Xendit
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-600 dark:text-slate-400 ml-1">
                  <li>Di Xendit Dashboard, buka <span className="font-medium text-slate-800 dark:text-slate-200">Settings</span> &rarr; <span className="font-medium text-slate-800 dark:text-slate-200">Developers</span> &rarr; <span className="font-medium text-slate-800 dark:text-slate-200">Callbacks</span></li>
                  <li>Cari bagian <span className="font-medium text-slate-800 dark:text-slate-200">Payment Request</span> (atau Payment)</li>
                  <li>Klik <span className="font-medium text-slate-800 dark:text-slate-200">Edit URL</span>, paste Webhook URL dari section bawah halaman ini</li>
                  <li>Pastikan status callback sudah <span className="text-green-600 font-medium">Active</span></li>
                  <li>Copy <span className="font-medium text-slate-800 dark:text-slate-200">Webhook Verification Token</span> dari Xendit, paste di kolom yang tersedia di bawah</li>
                  <li>Klik <span className="font-medium text-orange-600">Simpan Pengaturan</span></li>
                </ol>
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 mt-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-semibold">Tips:</span> Gunakan mode Development untuk testing tanpa transaksi nyata. Setelah siap, ganti ke Production key.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toggle */}
      <Card className={CARD}>
        <CardContent className="px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-5 md:items-center md:gap-6">
            <div className="space-y-1">
              <Label className="text-base font-medium text-slate-900 dark:text-white">Aktifkan Payment Gateway</Label>
              <p className="text-sm text-slate-500">
                Jika aktif, fitur QRIS akan tersedia di halaman pesanan
              </p>
            </div>
            <div className="shrink-0 pt-0.5 md:pt-0">
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                disabled={!canManage}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Merchant Info */}
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Informasi Bisnis
          </CardTitle>
          <CardDescription className="text-xs">Nama yang tampil di halaman pembayaran</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nama Merchant / Bisnis</Label>
            <Input
              placeholder="Contoh: Poles Headlamp Indonesia"
              value={config.merchantName}
              onChange={(e) => setConfig({ ...config, merchantName: e.target.value })}
              disabled={!canManage}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </CardContent>
      </Card>

      {/* Xendit API */}
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Xendit API
          </CardTitle>
          <CardDescription className="text-xs">
            Dapatkan API Key dari{' '}
            <a
              href="https://dashboard.xendit.co/settings/developers#api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Xendit Dashboard &rarr; Settings &rarr; API Keys
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Secret API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  placeholder="xnd_production_..."
                  value={config.xenditSecretKey}
                  onChange={(e) => setConfig({ ...config, xenditSecretKey: e.target.value })}
                  disabled={!canManage}
                  className="pr-10 font-mono text-sm bg-white dark:bg-slate-950"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing || !config.xenditSecretKey}
                className="shrink-0 bg-white dark:bg-slate-950"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                <span className="ml-1.5">Test</span>
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Gunakan key Production untuk pembayaran nyata, atau Development untuk testing
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
            <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Webhook Verification Token</Label>
            <div className="relative">
              <Input
                type={showWebhookToken ? 'text' : 'password'}
                placeholder="Token verifikasi webhook dari Xendit"
                value={config.xenditWebhookToken}
                onChange={(e) => setConfig({ ...config, xenditWebhookToken: e.target.value })}
                disabled={!canManage}
                className="pr-10 font-mono text-sm bg-white dark:bg-slate-950"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-slate-600"
                onClick={() => setShowWebhookToken(!showWebhookToken)}
              >
                {showWebhookToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Dapat ditemukan di Xendit Dashboard &rarr; Settings &rarr; Developers &rarr; Callbacks
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bank Account */}
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="h-4 w-4 text-purple-500" />
            Rekening Bank Tujuan
          </CardTitle>
          <CardDescription className="text-xs">Rekening bisnis untuk penerimaan dana QRIS</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nama Bank</Label>
              <Input
                placeholder="BCA, BRI, Mandiri"
                value={config.bankName}
                onChange={(e) => setConfig({ ...config, bankName: e.target.value })}
                disabled={!canManage}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Nomor Rekening</Label>
              <Input
                placeholder="1234567890"
                value={config.bankAccountNumber}
                onChange={(e) => setConfig({ ...config, bankAccountNumber: e.target.value })}
                disabled={!canManage}
                className="font-mono bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">Atas Nama</Label>
              <Input
                placeholder="PT Poles Headlamp"
                value={config.bankAccountHolder}
                onChange={(e) => setConfig({ ...config, bankAccountHolder: e.target.value })}
                disabled={!canManage}
                className="bg-white dark:bg-slate-950"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-cyan-500" />
            Webhook URL
          </CardTitle>
          <CardDescription className="text-xs">
            Salin URL ini dan pasang di{' '}
            <a
              href="https://dashboard.xendit.co/settings/developers#callbacks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Xendit Dashboard &rarr; Settings &rarr; Callbacks
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-xs bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyWebhook}
              className="shrink-0 bg-white dark:bg-slate-950"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            URL ini otomatis terhubung ke server. Pastikan event "Payment" dicentang di Xendit Dashboard.
          </p>
        </CardContent>
      </Card>

      {/* Warning: Active without API Key */}
      {!config.xenditSecretKey && config.enabled && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Payment Gateway aktif tanpa API Key
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Sistem akan berjalan dalam mode mock (simulasi). Untuk transaksi nyata, masukkan Secret API Key dari Xendit.
            </p>
          </div>
        </div>
      )}

      {/* Save Button */}
      {canManage && (
        <div className="flex items-center justify-between pt-2 pb-4">
          {config.updatedAt && (
            <p className="text-xs text-slate-400">
              Terakhir disimpan: {new Date(config.updatedAt).toLocaleString('id-ID')}
            </p>
          )}
          {!config.updatedAt && <div />}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-600 hover:bg-orange-700 text-white px-6"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      )}
    </div>
  );
};
