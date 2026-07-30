import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import { Platform, SubChannel, User } from '../data';
import { Search, LayoutGrid, Share2, AlertCircle, Save, Loader2, Users, Check, ChevronDown, ChevronRight, Square } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../lib/supabaseClient';
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar";
import { Card } from "../../../components/ui/card";
import { cn } from "../../../components/ui/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible";
import { getSessionBackedEdgeHeaders } from '@/app/services/internal/sessionClientHeaders';
import { buildMakeServerUrl } from '@/app/services/internal/functionsBaseUrl';
import { isCsRole } from '@/app/data/roleHelpers';

interface AdvertiserAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  advertiser: User | null;
  platforms: Platform[];
  subChannels: SubChannel[];
  users: User[];
}

export const AdvertiserAccessModal: React.FC<AdvertiserAccessModalProps> = ({
  isOpen,
  onClose,
  advertiser,
  platforms,
  subChannels,
  users,
}) => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [selectedSubChannels, setSelectedSubChannels] = useState<Set<string>>(new Set());
  const [selectedCsIds, setSelectedCsIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());

  // Load permissions and CS links when modal opens or advertiser changes
  useEffect(() => {
    if (isOpen && advertiser) {
      fetchPermissions(advertiser.id);
      
      // Initialize connected CS
      // We now load this from API fetchPermissions instead of checking users prop
      // const connectedCs = users.filter(u => u.role === 'CS' && u.parentUserId === advertiser.id);
      // setSelectedCsIds(new Set(connectedCs.map(u => u.id)));
      
      setSearchQuery("");
      setExpandedPlatforms(new Set()); 
    }
  }, [isOpen, advertiser]); // Removed users dependency as we fetch config from server

  const fetchPermissions = async (advertiserId: string) => {
    setIsLoading(true);
    try {
      const headers = await getSessionBackedEdgeHeaders();
      const response = await fetch(buildMakeServerUrl(`/access-config/${advertiserId}`), {
        headers,
      });
      
      if (!response.ok) throw new Error('Failed to fetch config');
      
      const data = await response.json();
      const platformIds = new Set<string>(data.platformIds || []);
      setSelectedPlatforms(platformIds);
      setSelectedSubChannels(new Set(data.subChannelIds || []));
      setSelectedCsIds(new Set(data.csIds || []));
      
      // Auto expand selected platforms
      setExpandedPlatforms(platformIds);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      toast.error("Gagal memuat konfigurasi akses");
    } finally {
      setIsLoading(false);
    }
  };

  if (!advertiser) return null;

  const handleTogglePlatform = (id: string, e?: React.MouseEvent) => {
    // Prevent event bubbling if clicking switch directly
    if (e) e.stopPropagation();

    const newSet = new Set(selectedPlatforms);
    const newExpanded = new Set(expandedPlatforms);
    
    if (newSet.has(id)) {
      newSet.delete(id);
      newExpanded.delete(id); // Collapse when disabled
      
      // Clear child subchannels
      const childSubChannels = subChannels.filter(sc => sc.platformId === id);
      const newSubChannelSet = new Set(selectedSubChannels);
      childSubChannels.forEach(sc => newSubChannelSet.delete(sc.id));
      setSelectedSubChannels(newSubChannelSet);

    } else {
      newSet.add(id);
      newExpanded.add(id); // Auto expand when enabled
    }
    
    setSelectedPlatforms(newSet);
    setExpandedPlatforms(newExpanded);
  };

  const handleToggleSubChannel = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(selectedSubChannels);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSubChannels(newSet);
  };

  const handleToggleCs = (id: string) => {
    const newSet = new Set(selectedCsIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedCsIds(newSet);
  };

  const toggleExpandPlatform = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSet = new Set(expandedPlatforms);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedPlatforms(newSet);
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 2. Save CS Links (And Platforms/Subchannels)
      const payload = {
        platformIds: Array.from(selectedPlatforms),
        subChannelIds: Array.from(selectedSubChannels),
        csIds: Array.from(selectedCsIds)
      };
      const headers = await getSessionBackedEdgeHeaders({ includeJsonContentType: true });

      const configResponse = await fetch(buildMakeServerUrl(`/access-config/${advertiser.id}`), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!configResponse.ok) {
        let errMsg = 'Failed to save config';
        try {
            const errData = await configResponse.json();
            if (errData && errData.error) errMsg = errData.error;
        } catch (e) {
            // ignore
        }
        throw new Error(errMsg);
      }
      
      // Update local context if needed, but since we rely on MasterDataContext refresh, 
      // we might want to trigger a reload or optimistic update.
      // For now, a toast success is enough, the user might need to refresh page or we can trigger context reload.
      // However, we removed the direct Profile update which caused the error.

      toast.success("Konfigurasi advertiser berhasil diperbarui");
      onClose();
      window.location.reload(); // Simple way to refresh context for now, or use context method if available
      
    } catch (error: any) {
      toast.error("Gagal menyimpan perubahan");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter lists based on search
  const filteredPlatforms = platforms.filter(p => 
    p.status === 'active' && 
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     subChannels.some(sc => sc.platformId === p.id && sc.name.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const csUsers = users.filter(u => isCsRole(u.role));
  const filteredCsUsers = csUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-50 dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800 p-0 overflow-hidden flex flex-col h-[80vh]">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
             <Avatar className="h-12 w-12 border-2 border-slate-100 dark:border-slate-800">
                <AvatarImage src={advertiser.avatar_url || ''} />
                <AvatarFallback className="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-lg">
                   {advertiser.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
             </Avatar>
             <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                   Konfigurasi Akses Advertiser
                </DialogTitle>
                <DialogDescription className="text-slate-500 mt-1">
                   Atur platform dan tim CS untuk <span className="font-semibold text-slate-700 dark:text-slate-300">{advertiser.name}</span>
                </DialogDescription>
             </div>
          </div>

          <div className="relative mt-6">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
               type="text" 
               placeholder="Cari platform, sub-channel, atau CS..." 
               className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
        </DialogHeader>

        {isLoading ? (
            <div className="flex-1 flex items-center justify-center p-10 min-h-[400px]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        ) : (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                <div className="p-6 space-y-8">
                    
                    {/* Section 1: Platform & Channels */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <LayoutGrid className="w-5 h-5 text-blue-600" />
                            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Akses Platform & Channel</h3>
                        </div>
                        
                        {filteredPlatforms.length === 0 ? (
                             <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-slate-400 italic text-sm">Tidak ada platform yang cocok dengan pencarian.</p>
                             </div>
                        ) : (
                             <div className="grid gap-4">
                                {filteredPlatforms.map(platform => {
                                    const platformSubChannels = subChannels.filter(sc => sc.platformId === platform.id);
                                    const isSelected = selectedPlatforms.has(platform.id);
                                    const isExpanded = expandedPlatforms.has(platform.id);
                                    const hasChannels = platformSubChannels.length > 0;
                                    
                                    return (
                                        <Collapsible 
                                            key={platform.id} 
                                            open={isSelected && isExpanded && hasChannels}
                                            onOpenChange={() => toggleExpandPlatform(platform.id)}
                                            className={cn("border rounded-xl transition-all duration-200 overflow-hidden bg-white dark:bg-slate-900", 
                                                isSelected 
                                                    ? "border-blue-200 dark:border-slate-700 shadow-sm ring-1 ring-blue-500/10" 
                                                    : "border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100 hover:border-blue-200"
                                            )}
                                        >
                                            {/* Header - Clickable to toggle switch */}
                                            <div 
                                                className="p-4 flex items-center justify-between cursor-pointer select-none group"
                                                onClick={() => handleTogglePlatform(platform.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center transition-colors", 
                                                        isSelected ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                                    )}>
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className={cn("font-semibold text-sm transition-colors", isSelected ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400")}>
                                                            {platform.name}
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {platformSubChannels.length} Sub-Channel tersedia
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-3 mr-2">
                                                        <span className={cn("text-xs font-medium transition-colors hidden sm:inline-block", isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400")}>
                                                            {isSelected ? 'Aktif' : 'Nonaktif'}
                                                        </span>
                                                        <Switch 
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleTogglePlatform(platform.id)}
                                                            className="data-[state=checked]:bg-blue-600"
                                                        />
                                                    </div>
                                                    
                                                    {/* Expansion Trigger - Only visible if selected & has channels */}
                                                    <div className={cn("w-8 flex justify-center transition-opacity", 
                                                        (isSelected && hasChannels) ? "opacity-100" : "opacity-0 pointer-events-none"
                                                    )}>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                                                            onClick={(e) => toggleExpandPlatform(platform.id, e)}
                                                        >
                                                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Sub Channels Section */}
                                            <CollapsibleContent>
                                                <div className="bg-slate-50/50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 p-4 pl-4 sm:pl-[4.5rem] animate-in slide-in-from-top-2 duration-200">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                            <Share2 className="w-3.5 h-3.5" />
                                                            Pilih Sub-Channel
                                                        </h5>
                                                        <Badge variant="secondary" className="text-[10px] h-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                                            {platformSubChannels.filter(sc => selectedSubChannels.has(sc.id)).length} dipilih
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="flex flex-wrap gap-2">
                                                        {platformSubChannels.map(sc => {
                                                            const isChannelSelected = selectedSubChannels.has(sc.id);
                                                            return (
                                                                <button
                                                                    key={sc.id}
                                                                    onClick={(e) => handleToggleSubChannel(sc.id, e)}
                                                                    className={cn(
                                                                        "group relative flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all duration-200",
                                                                        isChannelSelected
                                                                            ? "bg-white dark:bg-slate-800 border-blue-500 dark:border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-500"
                                                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                                    )}
                                                                >
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                                                        isChannelSelected
                                                                            ? "bg-blue-500 border-blue-500"
                                                                            : "border-slate-300 dark:border-slate-600 bg-transparent group-hover:border-blue-400"
                                                                    )}>
                                                                        {isChannelSelected && <Check className="w-3 h-3 text-white" />}
                                                                    </div>
                                                                    <span className="font-medium">{sc.name}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}
                             </div>
                        )}
                    </div>

                    {/* Section 2: Tim CS */}
                    <div className="space-y-4 pt-6 border-t border-dashed border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Tim Customer Service</h3>
                                <p className="text-xs text-slate-500">Pilih CS yang akan menjadi bawahan advertiser ini.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredCsUsers.length === 0 ? (
                                <div className="col-span-full text-center py-8 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                    <p className="text-slate-400 italic text-sm">Tidak ada user CS yang cocok.</p>
                                </div>
                            ) : (
                                filteredCsUsers.map(cs => {
                                    const isSelected = selectedCsIds.has(cs.id);
                                    // Removed restriction: Allow multiple advertiser assignments for testing
                                    
                                    return (
                                        <div 
                                            key={cs.id}
                                            onClick={() => handleToggleCs(cs.id)}
                                            className={cn(
                                                "relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 group select-none",
                                                isSelected
                                                    ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm ring-1 ring-blue-500/20"
                                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                            )}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700">
                                                    <AvatarImage src={cs.avatar || ''} />
                                                    <AvatarFallback className="text-xs bg-slate-100 text-slate-500 font-bold">
                                                        {cs.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                {/* Status Indicator for CS */}
                                                <span className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900", 
                                                    cs.status === 'active' ? "bg-emerald-500" : "bg-slate-300"
                                                )} />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h4 className={cn("font-medium text-sm truncate", isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-900 dark:text-slate-100")}>
                                                    {cs.name}
                                                </h4>
                                                <p className="text-xs text-slate-500 truncate">{cs.email}</p>
                                            </div>

                                            <div className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center transition-all",
                                                isSelected
                                                    ? "bg-blue-500 border-blue-500"
                                                    : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-blue-400"
                                            )}>
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    
                </div>
            </div>
        )}

        {/* Footer */}
        <DialogFooter className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-3 shrink-0">
            <div className="flex-1 flex items-center gap-2 text-xs text-slate-500">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                <span>Semua perubahan akan langsung diterapkan setelah disimpan.</span>
            </div>
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-10 px-6">
                Batal
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-200/50 dark:shadow-none">
                {isSaving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menyimpan...
                    </>
                ) : (
                    <>
                        <Save className="w-4 h-4" />
                        Simpan Konfigurasi
                    </>
                )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
