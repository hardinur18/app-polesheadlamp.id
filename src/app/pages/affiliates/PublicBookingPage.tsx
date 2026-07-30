import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { Affiliate } from '../../types/affiliate';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../components/ui/card';
import { Loader2, CheckCircle2, MapPin, Phone, User, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../lib/supabaseClient';

export const PublicBookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const affiliateId = searchParams.get('ref');
  
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isValidAffiliate, setIsValidAffiliate] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });

  useEffect(() => {
    const checkAffiliate = async () => {
      if (!affiliateId) return;
      
      try {
        // Try Direct DB (Supabase Client) - Most Reliable if table exists
        const { data: dbData, error: dbError } = await supabase
            .from('affiliates')
            .select('*')
            .eq('id', affiliateId)
            .single();

        if (dbData && !dbError) {
             if (dbData.status === 'Active') {
                setAffiliate(dbData);
                setIsValidAffiliate(true);
             } else {
                setIsValidAffiliate(false);
             }
             return;
        }

        setIsValidAffiliate(false);
      } catch (err) {
        console.error("Error checking affiliate", err);
      }
    };

    checkAffiliate();
  }, [affiliateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
        // Create Lead Payload
        // Generate a random ID for the lead
        const leadId = 'L' + Math.floor(Math.random() * 1000000);
        
        const now = new Date().toISOString();
        const newLead = {
            id: leadId,
            name: formData.name,
            phone: formData.phone,
            status: 'Pending',
            notes: `${formData.notes} | Alamat: ${formData.address}`,
            affiliate_id: affiliateId || null,
            last_contact: 'Baru saja',
            created_at: now,
        };

        const { error } = await supabase.from('leads').insert(newLead);
        if (error) throw error;

        setSubmitted(true);
        toast.success("Data berhasil dikirim!");

    } catch (error) {
        console.error('Error submitting form:', error);
        toast.error('Terjadi kesalahan, silakan coba lagi.');
    } finally {
        setLoading(false);
    }
  };

  if (submitted) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
            <Card className="w-full max-w-md text-center p-6 shadow-lg border-0">
                <div className="flex justify-center mb-4">
                    <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                </div>
                <CardTitle className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Terima Kasih!</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400 mb-6">
                    Data Anda telah kami terima. Tim kami akan segera menghubungi Anda melalui WhatsApp.
                </CardDescription>
                <Button onClick={() => window.location.reload()} variant="outline">
                    Isi Form Baru
                </Button>
            </Card>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-10 px-4 font-sans">
      
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-blue-700 tracking-tight">RHI System</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Restoration Headlamp Indonesia</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl p-6">
            <CardTitle className="text-xl font-bold">Formulir Booking Service</CardTitle>
            <CardDescription className="text-blue-100">
                Silakan lengkapi data di bawah ini untuk konsultasi atau booking jadwal.
            </CardDescription>
        </CardHeader>
        
        {affiliate && (
            <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-3 border-b border-blue-100 dark:border-blue-800 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Direferensikan oleh: <span className="font-bold">{affiliate.nama_lengkap}</span>
                </p>
            </div>
        )}

        <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 p-6">
                <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <User className="h-4 w-4 text-slate-400" /> Nama Lengkap
                    </Label>
                    <Input 
                        id="name" 
                        placeholder="Contoh: Budi Santoso"
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Phone className="h-4 w-4 text-slate-400" /> Nomor WhatsApp
                    </Label>
                    <Input 
                        id="phone" 
                        type="tel"
                        placeholder="Contoh: 081234567890"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 transition-colors"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <MapPin className="h-4 w-4 text-slate-400" /> Alamat / Lokasi
                    </Label>
                    <Textarea 
                        id="address" 
                        placeholder="Contoh: Jl. Sudirman No. 1, Jakarta Pusat"
                        required
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 transition-colors h-20 resize-none"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notes" className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <MessageSquare className="h-4 w-4 text-slate-400" /> Keluhan / Catatan
                    </Label>
                    <Textarea 
                        id="notes" 
                        placeholder="Contoh: Lampu menguning, ingin coating, dll."
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                        className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 transition-colors h-24 resize-none"
                    />
                </div>
            </CardContent>

            <CardFooter className="p-6 pt-0">
                <Button 
                    type="submit" 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-12 shadow-md transition-all hover:translate-y-[-1px]" 
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Mengirim...
                        </>
                    ) : (
                        "Kirim Data"
                    )}
                </Button>
            </CardFooter>
        </form>
      </Card>
      
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-500 text-center max-w-xs">
        &copy; {new Date().getFullYear()} RHI System. All rights reserved.<br/>
        Apps by Figma Make
      </p>
    </div>
  );
};
