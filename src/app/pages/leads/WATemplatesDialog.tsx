import React, { useState } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Plus, Trash2, Edit, Save, X, MessageSquare } from 'lucide-react';
import { useMasterData } from '../master-data/context';
import { WATemplate } from '../master-data/data';
import { toast } from 'sonner';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface WATemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryFilter?: 'Leads' | 'Orders' | 'General'; // Optional filter to show only specific category
}

export const WATemplatesDialog: React.FC<WATemplatesDialogProps> = ({ open, onOpenChange, categoryFilter }) => {
  const { waTemplates, addWATemplate, updateWATemplate, deleteWATemplate } = useMasterData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<WATemplate>>({});
  const [isAdding, setIsAdding] = useState(false);

  // Filter templates based on prop or show all
  const filteredTemplates = categoryFilter 
    ? waTemplates.filter(t => t.category === categoryFilter || !t.category) 
    : waTemplates;

  const startEdit = (template: WATemplate) => {
    setEditingId(template.id);
    setEditForm(template);
    setIsAdding(false);
  };

  const startAdd = () => {
    setEditingId(null);
    setEditForm({ 
        title: '', 
        message: '', 
        category: categoryFilter || 'General' 
    });
    setIsAdding(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!editForm.title || !editForm.message) {
      toast.error("Judul dan pesan tidak boleh kosong");
      return;
    }

    if (isAdding) {
      const newTemplate: WATemplate = {
        id: Math.random().toString(36).substr(2, 9),
        title: editForm.title,
        message: editForm.message
      };
      addWATemplate(newTemplate);
      toast.success("Template berhasil ditambahkan");
    } else if (editingId) {
      updateWATemplate({ ...editForm, id: editingId } as WATemplate);
      toast.success("Template berhasil diperbarui");
    }

    cancelEdit();
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah anda yakin ingin menghapus template ini?")) {
        deleteWATemplate(id);
        toast.success("Template berhasil dihapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 p-0 overflow-hidden rounded-xl max-h-[85vh] flex flex-col">
        <DialogHeader className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Kelola Template WhatsApp
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">
            Gunakan [Nama] untuk nama pelanggan, [Mobil] untuk kendaraan, dan [Order ID] untuk nomor pesanan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add New Button */}
          {!isAdding && !editingId && (
            <Button 
                onClick={startAdd}
                variant="outline" 
                className="w-full border-dashed border-2 border-slate-200 dark:border-slate-700 hover:border-green-500 hover:text-green-600 hover:bg-green-50 h-12"
            >
                <Plus className="mr-2 h-4 w-4" /> Tambah Template Baru
            </Button>
          )}

          {/* Edit/Add Form */}
          {(isAdding || editingId) && (
             <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Judul Template</label>
                    <Input 
                        value={editForm.title || ''} 
                        onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Contoh: Sapaan Awal"
                        className="bg-white dark:bg-slate-900"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori</label>
                    <Select 
                        value={editForm.category || 'General'} 
                        onValueChange={(val: any) => setEditForm(prev => ({ ...prev, category: val }))}
                    >
                        <SelectTrigger className="bg-white dark:bg-slate-900 h-8 text-xs">
                            <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Leads">Prospek (Leads)</SelectItem>
                            <SelectItem value="Orders">Pesanan (Orders)</SelectItem>
                            <SelectItem value="General">Umum</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Isi Pesan</label>
                    <Textarea 
                        value={editForm.message || ''} 
                        onChange={e => setEditForm(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Halo [Nama], ..."
                        className="bg-white dark:bg-slate-900 h-24 resize-none"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        Variabel tersedia: <span className="font-mono text-blue-600">[Nama]</span>, <span className="font-mono text-blue-600">[Mobil]</span>, <span className="font-mono text-blue-600">[Order ID]</span>
                    </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-8">Batal</Button>
                    <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 h-8 text-white">
                        <Save className="w-3.5 h-3.5 mr-1" /> Simpan
                    </Button>
                </div>
             </div>
          )}

          {/* List Templates */}
          <div className="space-y-3">
             {filteredTemplates.length === 0 && !isAdding && (
                 <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">Belum ada template untuk kategori ini.</div>
             )}
             
             {filteredTemplates.map(template => (
                 <div 
                    key={template.id} 
                    className={`group border rounded-lg p-3 transition-all ${editingId === template.id ? 'border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-900'}`}
                 >
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{template.title}</h4>
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 dark:text-slate-500 rounded border border-slate-200 dark:border-slate-700 uppercase tracking-wide">
                                    {template.category || 'General'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 leading-relaxed line-clamp-2">{template.message}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-blue-600"
                                onClick={() => startEdit(template)}
                                disabled={!!editingId || isAdding}
                            >
                                <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-red-600"
                                onClick={() => handleDelete(template.id)}
                                disabled={!!editingId || isAdding}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>
                 </div>
             ))}
          </div>
        </div>
        
        <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
             <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
