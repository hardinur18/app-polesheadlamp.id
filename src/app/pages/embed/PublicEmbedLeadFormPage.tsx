import React from 'react';
import { useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  fetchEmbedLeadFormBundle,
  fireEmbedLeadTracking,
  submitEmbedLeadForm,
  type EmbedLeadFieldKey,
  type EmbedLeadFormBundle,
  type EmbedLeadFormField,
} from '@/app/services/embedLeadForms';

const getUtmParams = () => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_term: params.get('utm_term') || undefined,
    utm_content: params.get('utm_content') || undefined,
  };
};

const getInitialAnswers = (bundle: EmbedLeadFormBundle) =>
  bundle.fields.reduce<Partial<Record<EmbedLeadFieldKey, string>>>((acc, field) => {
    acc[field.fieldKey] = '';
    return acc;
  }, {});

const getInputAutoComplete = (fieldKey: EmbedLeadFieldKey) => {
  if (fieldKey === 'name') return 'name';
  if (fieldKey === 'phone') return 'tel';
  return 'off';
};

const FieldControl = ({
  field,
  value,
  onChange,
}: {
  field: EmbedLeadFormField;
  value: string;
  onChange: (value: string) => void;
}) => {
  const hasOptions = field.options.length > 0;

  if (field.inputType === 'textarea') {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder || undefined}
        className="min-h-28 resize-y rounded-lg border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-slate-300"
      />
    );
  }

  if ((field.inputType === 'select' || field.inputType === 'radio') && hasOptions) {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
      >
        <option value="">{field.placeholder || `Pilih ${field.label}`}</option>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={field.inputType === 'tel' ? 'tel' : field.inputType === 'url' ? 'url' : 'text'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder || undefined}
      autoComplete={getInputAutoComplete(field.fieldKey)}
      className="rounded-lg border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-slate-300"
    />
  );
};

export function PublicEmbedLeadFormPage() {
  const { identifier } = useParams();
  const [bundle, setBundle] = React.useState<EmbedLeadFormBundle | null>(null);
  const [answers, setAnswers] = React.useState<Partial<Record<EmbedLeadFieldKey, string>>>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      if (!identifier) {
        setLoading(false);
        setError('Form tidak ditemukan.');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const nextBundle = await fetchEmbedLeadFormBundle(identifier, true);
        if (!active) return;

        if (!nextBundle) {
          setError('Form tidak aktif atau tidak ditemukan.');
          setBundle(null);
          return;
        }

        setBundle(nextBundle);
        setAnswers(getInitialAnswers(nextBundle));
      } catch (loadError: any) {
        if (!active) return;
        setError(loadError?.message || 'Gagal memuat form.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [identifier]);

  const setAnswer = (fieldKey: EmbedLeadFieldKey, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!bundle) return;

    const missingRequired = bundle.fields.find((field) => field.isRequired && !String(answers[field.fieldKey] || '').trim());
    if (missingRequired) {
      setError(`${missingRequired.label} wajib diisi.`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitEmbedLeadForm(bundle, {
        answers,
        landingPageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        referrerUrl: typeof document !== 'undefined' ? document.referrer : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        utm: getUtmParams(),
        trackingContext: {
          viewport: typeof window !== 'undefined'
            ? { width: window.innerWidth, height: window.innerHeight }
            : undefined,
        },
      });

      await fireEmbedLeadTracking(bundle.form);
      setSuccess(true);

      if (bundle.form.redirectUrl) {
        window.setTimeout(() => {
          window.location.href = bundle.form.redirectUrl!;
        }, 900);
      }
    } catch (submitError: any) {
      setError(submitError?.message || 'Gagal mengirim form. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-slate-900">Form tidak tersedia</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!bundle) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-white p-5">
        <div className="mx-auto max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <h1 className="text-lg font-semibold text-emerald-900">Data berhasil dikirim</h1>
          <p className="mt-2 text-sm leading-6 text-emerald-700">
            {bundle.form.thankYouMessage || 'Tim kami akan segera menghubungi Anda melalui WhatsApp.'}
          </p>
        </div>
      </div>
    );
  }

  const visibleFields = bundle.fields.filter((field) => field.isVisible);

  return (
    <main className="min-h-screen bg-white p-4 font-sans text-slate-900">
      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-slate-950">{bundle.form.name}</h1>
          {bundle.form.description && (
            <p className="mt-1 text-sm leading-6 text-slate-500">{bundle.form.description}</p>
          )}
        </div>

        {visibleFields.map((field) => (
          <div key={field.fieldKey} className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              {field.label}
              {field.isRequired && <span className="ml-1 text-red-500">*</span>}
            </Label>
            <FieldControl
              field={field}
              value={answers[field.fieldKey] || ''}
              onChange={(value) => setAnswer(field.fieldKey, value)}
            />
            {field.helpText && <p className="text-xs leading-5 text-slate-500">{field.helpText}</p>}
          </div>
        ))}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-5 text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-slate-950 text-white hover:bg-slate-800"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting ? 'Mengirim...' : bundle.form.submitButtonLabel}
        </Button>
      </form>
    </main>
  );
}
