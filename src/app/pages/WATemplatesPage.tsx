import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Plus, MessageSquare, Edit, Trash2, MoreVertical, Copy, Check, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "../components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "../components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useMasterData } from '@/app/pages/master-data/context';
import { logActivity } from '@/app/services/auditService';
import { usePermissions } from '@/app/hooks/usePermissions';
import { WATemplate } from '@/app/pages/master-data/data';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';

export const WATemplatesPage = () => {
  const { waTemplates, addWATemplate, updateWATemplate, deleteWATemplate, currentUser } = useMasterData();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WATemplate>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const messageRef = useRef<HTMLTextAreaElement>(null);

  const AVAILABLE_VARIABLES = [
    { label: 'Nama Customer', value: '[Nama]' },
    { label: 'ID Order', value: '[Order ID]' },
    { label: 'Tipe Mobil', value: '[Mobil]' },
    { label: 'Alamat Lengkap', value: '[Alamat]' },
    { label: 'Tanggal Service', value: '[Tanggal]' },
    { label: 'Jam Service', value: '[Jam]' },
    { label: 'Jenis Layanan', value: '[Layanan]' },
    { label: 'Total Harga', value: '[Total]' },
  ];

  // Filtering
  const filteredTemplates = useMemo(() => {
    return waTemplates.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) || 
                            t.message.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [waTemplates, search, categoryFilter]);

  // Grouping
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, WATemplate[]> = {
      'Leads': [],
      'Orders': [],
      'Teknisi': [],
      'General': []
    };
    
    filteredTemplates.forEach(t => {
      const cat = t.category || 'General';
      if (groups[cat]) {
        groups[cat].push(t);
      } else {
        // Fallback for unknown categories
        if (!groups['General']) groups['General'] = [];
        groups['General'].push(t);
      }
    });
    
    return groups;
  }, [filteredTemplates]);

  // Actions
  const handleAddNew = () => {
    setEditingId(null);
    setEditForm({ category: 'General', title: '', message: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: WATemplate) => {
    setEditingId(template.id);
    setEditForm({ ...template });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const templateToDelete = waTemplates.find(t => t.id === deleteId);
      deleteWATemplate(deleteId);
      toast.success('Template berhasil dihapus');
      if (currentUser && templateToDelete) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'DELETE', 'Template WhatsApp',
          `Menghapus template WA: ${templateToDelete.title}`,
          deleteId
        );
      }
      setDeleteId(null);
    }
  };

  const handleSave = async () => {
    if (!editForm.title || !editForm.message) {
      toast.error('Judul dan pesan wajib diisi');
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    if (editingId) {
      // Check if category changed and if target category is full
      const oldTemplate = waTemplates.find(t => t.id === editingId);
      if (oldTemplate && oldTemplate.category !== editForm.category) {
          const targetCategoryCount = waTemplates.filter(t => t.category === editForm.category).length;
          if (targetCategoryCount >= 10) {
              toast.error(`Kategori ${editForm.category} sudah mencapai batas maksimum (10 template).`);
              setIsSubmitting(false);
              return;
          }
      }

      updateWATemplate({ ...editForm, id: editingId } as WATemplate);
      toast.success('Template berhasil diperbarui');
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'UPDATE', 'Template WhatsApp',
          `Memperbarui template WA: ${editForm.title}`,
          editingId
        );
      }
    } else {
      // Check limit for new template
      const targetCategoryCount = waTemplates.filter(t => t.category === (editForm.category || 'General')).length;
      if (targetCategoryCount >= 10) {
          toast.error(`Kategori ${editForm.category || 'General'} sudah mencapai batas maksimum (10 template).`);
          setIsSubmitting(false);
          return;
      }

      const newTemplate: WATemplate = {
        id: Math.random().toString(36).substring(2, 6).toUpperCase(),
        title: editForm.title!,
        message: editForm.message!,
        category: (editForm.category as any) || 'General'
      };
      addWATemplate(newTemplate);
      toast.success('Template berhasil dibuat');
      if (currentUser) {
        logActivity(
          { id: currentUser.id, name: currentUser.name, role: currentUser.role },
          'CREATE', 'Template WhatsApp',
          `Membuat template WA baru: ${newTemplate.title}`,
          newTemplate.id
        );
      }
    }
    setIsSubmitting(false);
    setIsDialogOpen(false);
  };

  const handleInsertVariable = (variable: string) => {
    const textarea = messageRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editForm.message || '';
    
    const newText = text.substring(0, start) + variable + text.substring(end);
    
    setEditForm(prev => ({ ...prev, message: newText }));
    
    // Restore focus and cursor position
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const handleCopyToClipboard = (text: string) => {
    copyToClipboard(text, { successMessage: 'Pesan disalin ke clipboard' });
  };

  const getCategoryColor = (cat?: string) => {
      switch(cat) {
          case 'Leads': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
          case 'Orders': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
          case 'Teknisi': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
          default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      }
  };

  const getCategoryLabel = (cat: string) => {
      switch(cat) {
          case 'Leads': return 'Prospek (Leads)';
          case 'Orders': return 'Pesanan (Orders)';
          case 'Teknisi': return 'Teknisi';
          default: return 'Umum';
      }
  };

  return (
    <div className="p-4 md:p-8 w-full max-w-[1600px] mx-auto min-h-screen bg-slate-50/50 dark:bg-slate-950 transition-colors duration-300">
      <div className="flex flex-col space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-600 dark:text-green-500" />
                Template WhatsApp
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Kelola pesan standar untuk respon cepat ke pelanggan</p>
          </div>
          {hasPermission('wa_template.create') && (
            <Button 
                className="bg-green-600 hover:bg-green-700 text-white shadow-sm dark:bg-green-600 dark:hover:bg-green-700"
                onClick={handleAddNew}
            >
                <Plus className="mr-2 h-4 w-4" /> Buat Template Baru
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between transition-colors">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Input 
                        placeholder="Cari template..." 
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[180px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200">
                        <SelectValue placeholder="Semua Kategori" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 z-[9999] border border-slate-200 dark:border-slate-700 shadow-xl">
                        <SelectItem value="all" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Semua Kategori</SelectItem>
                        <SelectItem value="Leads" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Prospek (Leads)</SelectItem>
                        <SelectItem value="Orders" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Pesanan (Orders)</SelectItem>
                        <SelectItem value="Teknisi" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Teknisi</SelectItem>
                        <SelectItem value="General" className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Umum</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">
                Menampilkan <strong>{filteredTemplates.length}</strong> template
            </div>
        </div>

        {/* Content Grid */}
        <div className="space-y-8">
            {filteredTemplates.length === 0 ? (
                <div className="py-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 transition-colors">
                    <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200">Tidak ada template ditemukan</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Coba ubah filter pencarian atau buat template baru.</p>
                </div>
            ) : (
                ['Leads', 'Orders', 'Teknisi', 'General'].map(category => {
                    const templates = groupedTemplates[category] || [];
                    if (templates.length === 0) return null;
                    
                    return (
                        <div key={category} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                <Badge variant="outline" className={`px-3 py-1 text-sm font-medium border-0 ${getCategoryColor(category)}`}>
                                    {getCategoryLabel(category)}
                                </Badge>
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                                    ({templates.length})
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map(template => (
                                    <div key={template.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col group relative overflow-hidden">
                                        <div className="p-5 flex-1">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    {/* Optional: Add icon based on category? */}
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 ml-auto">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 z-[9999] border border-slate-200 dark:border-slate-700 shadow-xl min-w-[160px]">
                                                        <DropdownMenuItem onClick={() => handleCopyToClipboard(template.message)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">
                                                            <Copy className="w-4 h-4 mr-2" /> Salin Pesan
                                                        </DropdownMenuItem>
                                                        {hasPermission('wa_template.edit') && (
                                                            <DropdownMenuItem onClick={() => handleEdit(template)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">
                                                                <Edit className="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        {hasPermission('wa_template.delete') && (
                                                            <DropdownMenuItem onClick={() => handleDelete(template.id)} className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20">
                                                                <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            <h3 className="font-semibold text-slate-900 dark:text-slate-200 mb-2">{template.title}</h3>
                                            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 relative transition-colors h-[100px] overflow-y-auto custom-scrollbar">
                                                <p className="leading-relaxed whitespace-pre-wrap text-xs">{template.message}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span>ID: {template.id}</span>
                                                {(template.usage_count || 0) > 0 && (
                                                     <span className="flex items-center text-green-600 dark:text-green-500 font-medium bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                                         <Check className="w-3 h-3 mr-1" />
                                                         {template.usage_count}x Dipakai
                                                     </span>
                                                )}
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {hasPermission('wa_template.edit') && (
                                                    <button onClick={() => handleEdit(template)} className="hover:text-blue-600 dark:hover:text-blue-400 font-medium">Edit</button>
                                                )}
                                                {hasPermission('wa_template.delete') && (
                                                    <button onClick={() => handleDelete(template.id)} className="hover:text-red-600 dark:hover:text-red-400 font-medium">Hapus</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>

      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-800 dark:border-slate-700">
            <DialogHeader>
                <DialogTitle className="dark:text-slate-200">{editingId ? 'Edit Template' : 'Buat Template Baru'}</DialogTitle>
                <DialogDescription className="dark:text-slate-400">
                    Gunakan tombol <span className="font-medium text-slate-700 dark:text-slate-300">Sisipkan Variabel</span> untuk menambahkan data dinamis seperti Nama, Mobil, dll.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Judul Template</label>
                    <Input 
                        value={editForm.title || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Misal: Follow Up H+3"
                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
                    <Select 
                        value={editForm.category} 
                        onValueChange={(val: any) => setEditForm(prev => ({ ...prev, category: val }))}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200">
                            <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-800 z-[9999] border border-slate-200 dark:border-slate-700 shadow-xl">
                            <SelectItem value="Leads" className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 cursor-pointer">Prospek (Leads)</SelectItem>
                            <SelectItem value="Orders" className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 cursor-pointer">Pesanan (Orders)</SelectItem>
                            <SelectItem value="Teknisi" className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 cursor-pointer">Teknisi</SelectItem>
                            <SelectItem value="General" className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 cursor-pointer">Umum</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Isi Pesan</label>
                    <Textarea 
                        ref={messageRef}
                        value={editForm.message || ''}
                        onChange={e => setEditForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Halo Kak [Nama]..."
                        className="min-h-[120px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-200"
                    />
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="text-xs h-8 gap-2 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700">
                                    <Plus className="w-3 h-3" />
                                    Sisipkan Variabel
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 z-[9999] border border-slate-200 dark:border-slate-700 shadow-xl max-h-[300px] overflow-y-auto">
                                {AVAILABLE_VARIABLES.map(v => (
                                    <DropdownMenuItem key={v.value} onClick={() => handleInsertVariable(v.value)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 justify-between gap-4">
                                        <span>{v.label}</span>
                                        <span className="text-slate-400 font-mono text-[10px] bg-slate-100 dark:bg-slate-900 px-1 rounded">{v.value}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting} className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700">Batal</Button>
                <Button onClick={handleSave} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white min-w-[140px]">
                   {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Simpan...</> : "Simpan Template"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Apakah Anda yakin?</AlertDialogTitle>
            <AlertDialogDescription>
              Template yang dihapus tidak dapat dikembalikan lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-0">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};