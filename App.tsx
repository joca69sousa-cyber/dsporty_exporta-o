import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Trash2, CheckCircle, Package, Plus, X, Camera, User, 
    TrendingUp, Search, Image as ImageIcon, Printer, Check, 
    FileSpreadsheet, Target, Activity, LayoutList, Moon, Sun,
    UserSearch, AlertTriangle, Grid, Save, ArrowDown, LogOut,
    AlertOctagon, Lock, Wifi, WifiOff, RefreshCw
} from 'lucide-react';

import { supabase } from './services/supabase';
import { 
    ADMIN_MASTER_KEY, 
    APP_ID, 
    PRODUCT_DATA, 
    PRODUCT_OPTIONS, 
    calculateValue 
} from './constants';
import { 
    ProductionRecord, 
    BatchItem, 
    GlobalStats, 
    TimeRange, 
    AdminTab,
    UserStats
} from './types';

// Helper to persist data in offline mode
const saveToLocalStorage = (records: ProductionRecord[]) => {
    const dataToSave = records.map(r => ({
        ...r,
        timestamp: r.timestamp.toDate().toISOString() // Save as ISO string for storage
    }));
    localStorage.setItem('dsporty_offline_data', JSON.stringify(dataToSave));
};

// Helper to convert Supabase response to App internal format
const mapSupabaseRecord = (record: any): ProductionRecord => ({
    ...record,
    timestamp: {
        toDate: () => new Date(record.timestamp),
        toMillis: () => new Date(record.timestamp).getTime()
    }
});

function App() {
    const [userId, setUserId] = useState<string | null>(null);
    const [records, setRecords] = useState<ProductionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminKeyInput, setAdminKeyInput] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [adminTab, setAdminTab] = useState<AdminTab>('overview'); 
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'dark';
    });

    // Network State
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);

    // Filtros Administrativos
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [timeRange, setTimeRange] = useState<TimeRange>('today'); 

    // Estados do Formulário
    const [newExporter, setNewExporter] = useState('');
    const [newProduct, setNewProduct] = useState(PRODUCT_OPTIONS[0]);
    const [newQuantity, setNewQuantity] = useState('');
    const [newMaterialId, setNewMaterialId] = useState('');
    const [newImageBase64, setNewImageBase64] = useState<string | null>(null); 
    const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
    const [formError, setFormError] = useState('');

    // Estados para Limpeza de Banco
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePasswordInput, setDeletePasswordInput] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteFeedback, setDeleteFeedback] = useState('');

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    // Função de Sincronização
    const syncOfflineData = useCallback(async () => {
        const saved = localStorage.getItem('dsporty_offline_data');
        if (!saved) return;
        
        try {
            const localRecords = JSON.parse(saved);
            // Identifica registros que começam com 'local_' (salvos offline)
            const pendingRecords = localRecords.filter((r: any) => 
                r.id && r.id.toString().startsWith('local_')
            );

            if (pendingRecords.length > 0) {
                setIsSyncing(true);
                setFormError(`Sincronizando ${pendingRecords.length} registros pendentes...`);
                
                let successCount = 0;

                for (const record of pendingRecords) {
                    // Prepara payload removendo o ID local e formatando timestamp
                    const payload = {
                        exporter: record.exporter,
                        product: record.product,
                        quantity: record.quantity,
                        materialId: record.materialId,
                        imageDataUrl: record.imageDataUrl,
                        timestamp: record.timestamp, // Já deve estar em ISO string no storage
                        verified: false
                    };

                    const { error } = await supabase.from('production_records').insert(payload);
                    
                    if (!error) {
                        successCount++;
                        // Remove o registro local da memória para evitar duplicação visual
                        // A subscrição realtime vai trazer o registro oficial em breve
                        setRecords(prev => prev.filter(p => p.id !== record.id));
                    }
                }

                if (successCount > 0) {
                    setFormError(`Sincronização concluída! ${successCount} enviados.`);
                    setTimeout(() => setFormError(''), 3000);
                    
                    // Atualiza o localStorage removendo os itens sincronizados
                    const remaining = localRecords.filter((r: any) => !r.id.toString().startsWith('local_'));
                    // Nota: Idealmente buscaríamos do Supabase novamente, mas por segurança mantemos o cache limpo
                    localStorage.setItem('dsporty_offline_data', JSON.stringify(remaining));
                }
            }
        } catch (e) {
            console.error("Erro na sincronização:", e);
        } finally {
            setIsSyncing(false);
        }
    }, []);

    // Monitor de Rede
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncOfflineData();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Tenta sincronizar ao carregar se estiver online
        if (navigator.onLine) {
            syncOfflineData();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncOfflineData]);

    // Auth Effect (Supabase Anonymous)
    useEffect(() => {
        const initAuth = async () => {
            try {
                // Check if we have a session
                const { data, error } = await supabase.auth.getSession();
                if (error) throw error;
                
                if (data?.session) {
                    setUserId(data.session.user.id);
                } else {
                    // Anonymous sign in
                    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
                    if (signInError) throw signInError;
                    
                    if (signInData.user) {
                        setUserId(signInData.user.id);
                    }
                }
            } catch (e) {
                console.warn("Supabase Auth Error (using offline mode fallback):", e);
                setUserId('offline-user'); 
            } finally {
                setIsLoading(false);
            }
        };
        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) setUserId(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Data Effect (Supabase Realtime)
    useEffect(() => {
        // Se estiver offline, não tenta conectar no realtime, apenas carrega local
        if (!isOnline) {
             const saved = localStorage.getItem('dsporty_offline_data');
             if (saved) {
                 try {
                     const parsed = JSON.parse(saved);
                     const hydrated = parsed.map((r: any) => ({
                         ...r,
                         timestamp: {
                             toDate: () => new Date(r.timestamp),
                             toMillis: () => new Date(r.timestamp).getTime()
                         }
                     }));
                     setRecords(hydrated);
                 } catch (e) { console.error("Failed to load local data", e); }
             }
             return;
        }

        if (!userId) return;

        const fetchRecords = async () => {
            try {
                const { data, error } = await supabase
                    .from('production_records')
                    .select('*')
                    .order('timestamp', { ascending: false });
                
                if (error) throw error;

                if (data) {
                    setRecords(data.map(mapSupabaseRecord));
                }
            } catch (error) {
                console.error("Supabase Select Error:", error);
                // Try loading local data if Supabase fails
                const saved = localStorage.getItem('dsporty_offline_data');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        const hydrated = parsed.map((r: any) => ({
                            ...r,
                            timestamp: {
                                toDate: () => new Date(r.timestamp),
                                toMillis: () => new Date(r.timestamp).getTime()
                            }
                        }));
                        setRecords(hydrated);
                    } catch (e) { console.error("Failed to load local data", e); }
                }
            }
        };

        fetchRecords();

        // Realtime Subscription
        const channel = supabase
            .channel('public:production_records')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'production_records' }, (payload) => {
                fetchRecords();
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Connected
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn("Supabase Realtime channel error");
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, isOnline]); // Adicionado isOnline dependency

    // Lógica de Filtro Combinado (Tempo + Busca)
    const filteredByTimeRecords = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        
        return records.filter(r => {
            const date = r.timestamp.toDate();
            const search = adminSearchTerm.trim().toUpperCase();
            
            const matchesSearch = !search || 
                                (r.exporter || '').toUpperCase().includes(search) || 
                                (r.materialId || '').toUpperCase().includes(search);
            
            let matchesTime = true;
            if (timeRange === 'today') matchesTime = date >= startOfDay;
            else if (timeRange === 'week') {
                const lastWeek = new Date();
                lastWeek.setDate(now.getDate() - 7);
                matchesTime = date >= lastWeek;
            } else if (timeRange === 'month') {
                const lastMonth = new Date();
                lastMonth.setMonth(now.getMonth() - 1);
                matchesTime = date >= lastMonth;
            } else if (timeRange === 'year') {
                const lastYear = new Date();
                lastYear.setFullYear(now.getFullYear() - 1);
                matchesTime = date >= lastYear;
            }

            return matchesSearch && matchesTime;
        });
    }, [records, adminSearchTerm, timeRange]);

    // Group images by date for the gallery
    const groupedGalleryImages = useMemo(() => {
        const groups: Record<string, ProductionRecord[]> = {};
        const imagesOnly = filteredByTimeRecords.filter(r => r.imageDataUrl);
        
        imagesOnly.forEach(r => {
            const dateKey = r.timestamp.toDate().toLocaleDateString('pt-BR', { 
                weekday: 'short', 
                day: '2-digit', 
                month: 'long' 
            });
            // Capitalize first letter
            const formattedDate = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);
            
            if (!groups[formattedDate]) {
                groups[formattedDate] = [];
            }
            groups[formattedDate].push(r);
        });
        
        return groups;
    }, [filteredByTimeRecords]);

    const myRecords = useMemo(() => {
        const name = newExporter.trim().toUpperCase();
        if (!name) return [];
        return records.filter(r => (r.exporter || '').trim().toUpperCase() === name);
    }, [records, newExporter]);

    const userStats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return myRecords.reduce((acc, r) => {
            const rDate = r.timestamp.toDate();
            const val = calculateValue(r.product, r.quantity);
            
            if (rDate >= startOfDay) acc.daily += val;
            if (rDate >= startOfMonth) acc.monthly += val;
            
            return acc;
        }, { daily: 0, monthly: 0 });
    }, [myRecords]);

    const stats = useMemo(() => {
        const s: GlobalStats = { total: 0, count: 0, byUser: {}, byProduct: {}, verifiedTotal: 0 };
        filteredByTimeRecords.forEach(r => {
            const val = calculateValue(r.product, r.quantity);
            const qty = parseInt(r.quantity.toString()) || 0;
            s.total += val;
            s.count += qty;
            if (r.verified) s.verifiedTotal += val;

            const userKey = (r.exporter || 'SEM NOME').trim().toUpperCase();
            if (!s.byUser[userKey]) s.byUser[userKey] = { total: 0, items: 0, toPay: 0, details: [] };
            s.byUser[userKey].total += val;
            s.byUser[userKey].items += qty;
            if (r.verified) {
                s.byUser[userKey].toPay += val;
                s.byUser[userKey].details.push(r);
            }

            if (!s.byProduct[r.product]) s.byProduct[r.product] = { count: 0, total: 0 };
            s.byProduct[r.product].count += qty;
            s.byProduct[r.product].total += val;
        });
        return s;
    }, [filteredByTimeRecords]);

    const toggleVerify = async (id: string, currentStatus: boolean) => {
        if (!isOnline) {
            setFormError("Ação indisponível offline.");
            return;
        }
        try {
            const { error } = await supabase
                .from('production_records')
                .update({ verified: !currentStatus })
                .eq('id', id);
            
            if (error) throw error;
            
            // Optimistic update for verification
            setRecords(prev => prev.map(r => r.id === id ? { ...r, verified: !currentStatus } : r));

        } catch (e) { 
            console.error("Erro ao atualizar status:", e);
            // Fallback for visual update locally if offline
            const updated = records.map(r => r.id === id ? { ...r, verified: !currentStatus } : r);
            setRecords(updated);
            if (userId === 'offline-user') saveToLocalStorage(updated);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 800 * 1024) { setFormError("Imagem muito grande (máx 800KB)"); return; }
            setFormError("");
            const reader = new FileReader();
            reader.onloadend = () => setNewImageBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleAddToBatch = () => {
        const qty = parseInt(newQuantity);
        if (!newQuantity || qty <= 0 || !newMaterialId.trim()) return;
        setBatchItems([...batchItems, { 
            product: newProduct, 
            quantity: qty, 
            materialId: newMaterialId.trim().toUpperCase(), 
            tempId: Date.now() 
        }]);
        setNewQuantity(''); 
        setNewMaterialId('');
    };

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        const exporter = newExporter.trim().toUpperCase();
        if (!exporter) { setFormError('Informe o nome do colaborador'); return; }

        // Validação de Imagem Obrigatória
        if (!newImageBase64) {
            setFormError('É obrigatório anexar uma foto para finalizar o registro.');
            return;
        }
        
        let itemsToSubmit = [...batchItems];
        if (newQuantity && newMaterialId) {
            itemsToSubmit.push({ product: newProduct, quantity: parseInt(newQuantity), materialId: newMaterialId.trim().toUpperCase(), tempId: 0 });
        }
        if (itemsToSubmit.length === 0) { setFormError('Adicione pelo menos um item'); return; }

        // 1. Prepare Optimistic Data (Instant Feedback)
        const now = new Date();
        const tempIdBase = `temp_${Date.now()}`;
        
        const optimisticRecords: ProductionRecord[] = itemsToSubmit.map((item, index) => ({
            id: `${tempIdBase}_${index}`,
            exporter,
            product: item.product,
            quantity: item.quantity,
            materialId: item.materialId,
            imageDataUrl: newImageBase64,
            timestamp: { toDate: () => now, toMillis: () => now.getTime() },
            verified: false
        }));

        // 2. Update UI Immediately
        setRecords(prev => {
            const combined = [...optimisticRecords, ...prev];
            return combined.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
        });
        
        // Clear form immediately
        setBatchItems([]); 
        setNewImageBase64(null); 
        setNewQuantity(''); 
        setNewMaterialId('');
        setFormError('');

        // 3. Process Background Request OR Offline Save
        if (!isOnline) {
            setRecords(prev => {
                const updated = prev.map(r => {
                    if (r.id.startsWith(tempIdBase)) {
                        return { ...r, id: r.id.replace(tempIdBase, `local_${Date.now()}`) };
                    }
                    return r;
                });
                saveToLocalStorage(updated);
                return updated;
            });
            setFormError('Sem internet. Salvo localmente! Enviaremos quando reconectar.');
            return;
        }

        try {
            const dbPayload = itemsToSubmit.map(item => ({
                exporter, 
                product: item.product, 
                quantity: item.quantity, 
                materialId: item.materialId,
                imageDataUrl: newImageBase64, 
                timestamp: now.toISOString(), 
                verified: false
            }));

            // Insert and return data to get real IDs
            const { data, error } = await supabase.from('production_records').insert(dbPayload).select();

            if (error) throw error;

            // 4. Reconcile Real Data (Replace Temp IDs with Real IDs to avoid duplicates if Realtime triggers)
            if (data) {
                const realRecords = data.map(mapSupabaseRecord);
                setRecords(prev => {
                    // Filter out the specific temp records we added
                    const cleanPrev = prev.filter(r => !r.id.startsWith(tempIdBase));
                    const combined = [...realRecords, ...cleanPrev];
                    return combined.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
                });
            }
        } catch (e) { 
            console.error("Erro no envio, salvando offline", e);
            
            // 5. Handle Offline Fallback (if request failed despite online status)
            // Convert temp IDs to stable local IDs so they persist correctly
            setRecords(prev => {
                const updated = prev.map(r => {
                    if (r.id.startsWith(tempIdBase)) {
                        return { ...r, id: r.id.replace(tempIdBase, `local_${Date.now()}`) };
                    }
                    return r;
                });
                
                // Persist the updated list (including new local items)
                saveToLocalStorage(updated);
                return updated;
            });
            setFormError('Erro na conexão. Salvo localmente.');
        }
    };

    const handleDeleteRecord = async (id: string) => {
        try {
            if (id.startsWith('local_')) {
                const filtered = records.filter(r => r.id !== id);
                setRecords(filtered);
                saveToLocalStorage(filtered);
                return;
            }

            const { error } = await supabase
                .from('production_records')
                .delete()
                .eq('id', id);
            
            if (error) throw error;

            // Optimistic delete
            setRecords(prev => prev.filter(r => r.id !== id));
            
        } catch (e) { 
            console.error("Erro ao deletar", e);
            // Optimistic delete for UI if error occurs (assuming it might be gone anyway or network issue)
            const filtered = records.filter(r => r.id !== id);
            setRecords(filtered);
            if (userId === 'offline-user') saveToLocalStorage(filtered);
        }
    };

    const handleDatabaseWipe = async () => {
        if (!isOnline) {
            setDeleteFeedback("Necessário estar online para limpar o banco.");
            return;
        }
        if (deletePasswordInput.trim() !== ADMIN_MASTER_KEY) {
            setDeleteFeedback("Senha incorreta!");
            return;
        }

        setIsDeleting(true);
        setDeleteFeedback('');
        
        try {
            // OPTIMIZED DELETE: Delete all rows by using a broad filter.
            // .neq('exporter', 'non_existent') efficiently targets all rows without needing to fetch IDs first.
            const { error } = await supabase
                .from('production_records')
                .delete()
                .neq('exporter', '___NON_EXISTENT_VAL___');

            if (error) throw error;

            // Wipe local storage
            setRecords([]);
            localStorage.removeItem('dsporty_offline_data');
            
            setDeleteFeedback("Banco limpo com sucesso!");
            
            // Delay closing modal slightly to show success message
            setTimeout(() => {
                setShowDeleteModal(false);
                setDeletePasswordInput('');
                setDeleteFeedback('');
            }, 1000);
            
        } catch (e) {
            console.error("Erro ao limpar banco:", e);
            setDeleteFeedback("Erro ao deletar. Verifique permissões.");
        } finally {
            setIsDeleting(false);
        }
    };

    const generateAuditReport = () => {
        const auditedRecords = filteredByTimeRecords.filter(r => r.verified);
        if (auditedRecords.length === 0) { setFormError("Nenhum registro auditado encontrado."); return; }
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) { setFormError("Bloqueio de pop-up detetado."); return; }

        const reportDate = new Date().toLocaleDateString('pt-BR');
        let reportSections = (Object.entries(stats.byUser) as [string, UserStats][])
            .filter(([_, data]) => data.toPay > 0)
            .map(([name, data]) => {
                const itemRows = data.details.map(item => `
                    <tr style="font-size: 10px; color: #555;">
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${item.timestamp.toDate().toLocaleDateString('pt-BR')}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0;">${item.product}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0; text-align: center;">${item.quantity}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0; text-align: center;">${item.materialId}</td>
                        <td style="padding: 8px; border-bottom: 1px solid #f0f0f0; text-align: right;">R$ ${calculateValue(item.product, item.quantity).toFixed(2)}</td>
                    </tr>
                `).join('');
                return `
                <div style="margin-bottom: 40px; page-break-inside: avoid;">
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #000;">
                        <h2 style="margin: 0; font-size: 14px; text-transform: uppercase;">${name}</h2>
                        <span style="font-weight: 900; font-size: 14px;">TOTAL: R$ ${data.toPay.toFixed(2)}</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #fff; text-align: left; font-size: 9px; text-transform: uppercase; color: #999;">
                                <th style="padding: 8px; border-bottom: 2px solid #eee;">Data</th>
                                <th style="padding: 8px; border-bottom: 2px solid #eee;">Produto</th>
                                <th style="padding: 8px; border-bottom: 2px solid #eee; text-align: center;">Qtd</th>
                                <th style="padding: 8px; border-bottom: 2px solid #eee; text-align: center;">Ref/Lote</th>
                                <th style="padding: 8px; border-bottom: 2px solid #eee; text-align: right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${itemRows}</tbody>
                    </table>
                </div>`;
            }).join('');

        reportWindow.document.write(`
            <html><head><meta charset="UTF-8"><title>Relatório de Auditoria</title><style>body { font-family: sans-serif; padding: 40px; } .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; } @media print { .no-print { display: none; } }</style></head>
            <body>
                <div class="header"><h1>Relatório de Auditoria</h1><p>Período: ${timeRange.toUpperCase()} | Data: ${reportDate}</p></div>
                <div>${reportSections}</div>
                <div style="margin-top: 40px; padding: 20px; border: 2px solid #000; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 900; text-transform: uppercase;">Total Geral:</span>
                    <span style="font-size: 24px; font-weight: 900;">R$ ${stats.verifiedTotal.toFixed(2)}</span>
                </div>
                <button class="no-print" onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 8px; cursor: pointer;">Imprimir</button>
            </body></html>
        `);
        reportWindow.document.close();
    };

    if (isLoading) return <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-950 font-black uppercase text-slate-300 animate-pulse text-xs tracking-widest">A carregar...</div>;

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#FDFDFF] text-slate-900'}`}>
            
            {/* Aviso de Status Offline/Sincronização */}
            <div className={`w-full px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors duration-300 ${isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-500 text-white'}`}>
                {isSyncing ? (
                    <>
                       <RefreshCw size={12} className="animate-spin" /> Sincronizando dados...
                    </>
                ) : isOnline ? (
                    <>
                        <Wifi size={12} /> ONLINE • DADOS SINCRONIZADOS
                    </>
                ) : (
                    <>
                        <WifiOff size={12} /> OFFLINE • SALVANDO NO DISPOSITIVO
                    </>
                )}
            </div>

            <header className="sticky top-0 z-40 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 no-print">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-black dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-black rotate-3 shadow-lg">
                            <Activity size={20} />
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="font-black tracking-tighter uppercase italic text-sm">Produção Dsporty Performance</h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Central de Gestão</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Status Icon Small Screens */}
                        <div className={`sm:hidden p-2 rounded-full ${isOnline ? 'text-emerald-500' : 'text-rose-500 bg-rose-100'}`}>
                            {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        </div>

                        {/* Botão Tema */}
                        <button 
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:scale-105 transition-all"
                        >
                            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        {/* Input Senha Admin (Visível apenas se não for admin) */}
                        {!isAdmin && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2.5 gap-2 transition-all">
                                <Lock size={14} className="text-slate-400" />
                                <input
                                    type="password"
                                    placeholder="ADMIN"
                                    value={adminKeyInput}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAdminKeyInput(val);
                                        // Auto-login se a senha estiver correta
                                        if (val === ADMIN_MASTER_KEY) {
                                            setIsAdmin(true);
                                            setAdminKeyInput('');
                                        }
                                    }}
                                    className="w-16 bg-transparent border-none outline-none text-[10px] font-black text-slate-600 dark:text-slate-300 placeholder:text-slate-300 uppercase focus:w-24 transition-all"
                                />
                            </div>
                        )}

                        {isAdmin && (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl animate-in fade-in slide-in-from-right-4">
                                {[
                                    { id: 'overview', icon: <Target size={14}/> },
                                    { id: 'payments', icon: <FileSpreadsheet size={14}/> },
                                    { id: 'gallery', icon: <Grid size={14}/> },
                                    { id: 'detailed', icon: <LayoutList size={14}/> }
                                ].map(tab => (
                                    <button 
                                        key={tab.id}
                                        onClick={() => setAdminTab(tab.id as AdminTab)} 
                                        className={`p-2.5 rounded-xl transition-all ${adminTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-sm text-black dark:text-white' : 'text-slate-500'}`}
                                        title={tab.id.toUpperCase()}
                                    >
                                        {tab.icon}
                                    </button>
                                ))}
                                <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                <button 
                                    onClick={() => { setIsAdmin(false); setAdminKeyInput(''); }}
                                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
                                    title="Sair do Admin"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <div className="space-y-10 no-print">
                    
                    {/* Painel de Cadastro (TOPO) - Apenas para Não-Admins */}
                    {!isAdmin && (
                        <div className="w-full">
                            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-sm border border-slate-100 dark:border-slate-800 relative overflow-hidden">
                                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2 relative z-10">
                                    <Plus size={14}/> REGISTRA PRODUÇÃO
                                </h2>

                                {formError && (
                                    <div className={`mb-6 p-4 border rounded-2xl flex items-start gap-3 relative z-10 ${formError.includes('concluída') ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900 text-rose-600'}`}>
                                        {formError.includes('concluída') ? <CheckCircle size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                                        <p className="text-[10px] font-black uppercase leading-tight">{formError}</p>
                                    </div>
                                )}

                                <form onSubmit={handleAddRecord} className="relative z-10 space-y-6">
                                    {/* Linha 1: Colaborador */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Colaborador</label>
                                        <div className="relative group">
                                            <input 
                                                value={newExporter} 
                                                onChange={(e) => setNewExporter(e.target.value.toUpperCase())} 
                                                placeholder="NOME DO COLABORADOR" 
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-5 focus:ring-2 ring-slate-100 dark:ring-slate-700 outline-none font-black uppercase text-sm sm:text-base tracking-wide transition-all" 
                                            />
                                        </div>
                                    </div>

                                    {/* Linha 2: Itens (Grid) */}
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-[1.5rem] sm:rounded-3xl border border-slate-100 dark:border-slate-800/50">
                                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-1">
                                            <div className="sm:col-span-4 space-y-1">
                                                <div className="h-full relative">
                                                    <select value={newProduct} onChange={(e) => setNewProduct(e.target.value)} className="w-full h-full bg-white dark:bg-slate-800 border-none rounded-2xl sm:rounded-xl px-4 py-4 sm:py-0 text-xs font-black appearance-none outline-none shadow-sm cursor-pointer focus:ring-2 ring-black/5">
                                                        {PRODUCT_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <ArrowDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="sm:col-span-2 space-y-1">
                                                <input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} placeholder="QTD" className="w-full h-full bg-white dark:bg-slate-800 border-none rounded-2xl sm:rounded-xl px-4 py-4 sm:py-0 text-center text-xs font-black outline-none shadow-sm focus:ring-2 ring-black/5 placeholder:text-slate-300" />
                                            </div>
                                            <div className="sm:col-span-3 space-y-1">
                                                <input type="text" value={newMaterialId} onChange={(e) => setNewMaterialId(e.target.value.toUpperCase())} placeholder="REF/LOTE" className="w-full h-full bg-white dark:bg-slate-800 border-none rounded-2xl sm:rounded-xl px-4 py-4 sm:py-0 text-xs font-black outline-none uppercase shadow-sm focus:ring-2 ring-black/5 placeholder:text-slate-300" />
                                            </div>
                                            <div className="sm:col-span-3">
                                                <button type="button" onClick={handleAddToBatch} className="w-full h-full py-4 sm:py-4 rounded-2xl sm:rounded-xl bg-black dark:bg-white text-white dark:text-black text-[10px] font-black uppercase hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 dark:shadow-none">
                                                    <Plus size={14} /> ADICIONAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lista de Lote */}
                                    {batchItems.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                                            {batchItems.map((item) => (
                                                <div key={item.tempId} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-2">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase">{item.quantity}x {item.product}</p>
                                                        <p className="text-[9px] font-bold text-slate-400">REF: {item.materialId}</p>
                                                    </div>
                                                    <button type="button" onClick={() => setBatchItems(batchItems.filter(i => i.tempId !== item.tempId))} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"><X size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Ações Finais */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <label className={`flex items-center justify-center gap-3 w-full h-16 rounded-2xl cursor-pointer transition-all border-2 border-dashed ${newImageBase64 ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                            <Camera size={18} className={newImageBase64 ? "text-emerald-500" : "text-slate-400"} />
                                            <span className={`text-[9px] font-black uppercase ${newImageBase64 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                                {newImageBase64 ? "FOTO ANEXADA" : "ANEXAR FOTO"}
                                            </span>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                        </label>

                                        <button type="submit" className="w-full h-16 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-xl hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:hover:shadow-none disabled:hover:bg-emerald-500 flex items-center justify-center gap-2" disabled={batchItems.length === 0 && (!newQuantity || !newMaterialId)}>
                                            <Save size={16} /> FINALIZAR & GRAVAR
                                        </button>
                                    </div>

                                    {newImageBase64 && (
                                        <div className="relative aspect-video rounded-2xl overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-xl">
                                            <img src={newImageBase64} className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => setNewImageBase64(null)} className="absolute top-3 right-3 p-2 bg-black/80 text-white rounded-xl hover:bg-black transition-colors">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Dashboard/Visualização Principal (BAIXO) */}
                    <div className="w-full space-y-8">
                        {/* Filtros Administrativos */}
                        {isAdmin && (
                            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <UserSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input 
                                        type="text" 
                                        value={adminSearchTerm} 
                                        onChange={(e) => setAdminSearchTerm(e.target.value)} 
                                        placeholder="BUSCAR COLABORADOR OU REFERÊNCIA..." 
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-14 pr-5 py-4 focus:ring-2 ring-slate-100 dark:ring-slate-700 outline-none font-bold uppercase text-[10px] tracking-wider"
                                    />
                                    {adminSearchTerm && (
                                        <button onClick={() => setAdminSearchTerm('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-black dark:hover:text-white">
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl w-full">
                                        {[
                                            { id: 'today', label: 'Hoje' },
                                            { id: 'week', label: '7D' },
                                            { id: 'month', label: '30D' },
                                            { id: 'year', label: 'Ano' }
                                        ].map(range => (
                                            <button 
                                                key={range.id}
                                                onClick={() => setTimeRange(range.id as TimeRange)}
                                                className={`flex-1 px-4 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${timeRange === range.id ? 'bg-white dark:bg-slate-700 shadow-sm text-black dark:text-white' : 'text-slate-400'}`}
                                            >
                                                {range.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {isAdmin && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Produzido</p>
                                    <p className="text-2xl font-black tracking-tighter">R$ {stats.total.toFixed(2)}</p>
                                </div>
                                <div className="bg-black dark:bg-white p-8 rounded-[2.5rem] text-white dark:text-black shadow-xl">
                                    <p className="text-[10px] font-black text-white/40 dark:text-black/40 uppercase mb-1">Peças</p>
                                    <p className="text-2xl font-black tracking-tighter">{stats.count} un</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Auditado</p>
                                    <p className="text-2xl font-black tracking-tighter text-emerald-500">R$ {stats.verifiedTotal.toFixed(2)}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-6">
                            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-4">
                                {isAdmin ? `Aba: ${adminTab.toUpperCase()}` : "O Teu Histórico Recente"}
                            </h2>
                            
                            {/* Visualização de Log Detalhado */}
                            {isAdmin && adminTab === 'detailed' && (
                                <div className="space-y-4">
                                    {filteredByTimeRecords.length > 0 ? filteredByTimeRecords.map(r => (
                                        <div key={r.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center gap-5 hover:border-slate-300 transition-all shadow-sm">
                                            <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden cursor-pointer shrink-0" onClick={() => r.imageDataUrl && setSelectedImage(r.imageDataUrl)}>
                                                {r.imageDataUrl ? <img src={r.imageDataUrl} className="w-full h-full object-cover" /> : <Package size={20} className="text-slate-200 mx-auto mt-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-xs font-black uppercase truncate pr-2">{r.exporter}</p>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                            {r.timestamp?.toDate().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')}
                                                        </p>
                                                        <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wider">
                                                            {r.timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{r.quantity}x {r.product} — REF: {r.materialId}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => toggleVerify(r.id, r.verified)} 
                                                    className={`p-3 rounded-xl transition-all ${r.verified ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}`}
                                                >
                                                    <Check size={16}/>
                                                </button>
                                                <button 
                                                    onClick={async () => await handleDeleteRecord(r.id)} 
                                                    className="p-3 text-slate-200 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-20 text-slate-300 font-black uppercase text-[10px]">Nenhum registro encontrado</div>
                                    )}
                                </div>
                            )}

                            {/* Visualização de Galeria (Organizada por Data) */}
                            {isAdmin && adminTab === 'gallery' && (
                                <div className="space-y-8 animate-in fade-in duration-300">
                                    {Object.keys(groupedGalleryImages).length > 0 ? (
                                        (Object.entries(groupedGalleryImages) as [string, ProductionRecord[]][]).map(([dateStr, images]) => (
                                            <div key={dateStr}>
                                                <div className="flex items-center gap-3 mb-4 px-2">
                                                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{dateStr}</h3>
                                                    <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800"></div>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                    {images.map(r => (
                                                        <div 
                                                            key={r.id} 
                                                            className="group relative aspect-square bg-slate-100 dark:bg-slate-800 rounded-[2rem] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all"
                                                            onClick={() => r.imageDataUrl && setSelectedImage(r.imageDataUrl)}
                                                        >
                                                            <img src={r.imageDataUrl || ''} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Produção" />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                                                                <p className="text-[8px] font-black text-white uppercase truncate">{r.exporter}</p>
                                                                <p className="text-[7px] font-bold text-white/70 uppercase">{r.product} • {r.quantity} un</p>
                                                            </div>
                                                            {r.verified && (
                                                                <div className="absolute top-3 right-3 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                                                                    <Check size={10} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="col-span-full py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-100 dark:border-slate-800 text-center">
                                            <ImageIcon size={40} className="mx-auto text-slate-200 mb-4" />
                                            <p className="text-[10px] font-black text-slate-300 uppercase">Nenhuma foto encontrada</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Dashboard Geral */}
                            {isAdmin && adminTab === 'overview' && (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {Object.keys(stats.byProduct).length > 0 ? Object.keys(stats.byProduct).map((name) => {
                                            const data = stats.byProduct[name];
                                            return (
                                            <div key={name} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase ${PRODUCT_DATA[name]?.color}`}>{name}</span>
                                                    <TrendingUp size={16} className="text-slate-200" />
                                                </div>
                                                <div className="flex items-end justify-between">
                                                    <div>
                                                        <p className="text-2xl font-black tracking-tight">{data.count} <span className="text-xs text-slate-400">peças</span></p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total no período</p>
                                                    </div>
                                                    <p className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">R$ {data.total.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        )}) : (
                                            <div className="col-span-full text-center py-20 text-slate-300 font-black uppercase text-[10px]">Sem dados para exibir</div>
                                        )}
                                    </div>

                                    {/* Zona de Perigo - Limpar Banco */}
                                    <div className="pt-8 border-t border-slate-100 dark:border-slate-800/50">
                                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-white dark:bg-rose-900/40 rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                                                    <AlertOctagon size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase">Zona de Perigo</h3>
                                                    <p className="text-[10px] text-rose-400 dark:text-rose-300/70 font-bold uppercase mt-1">Esta ação é irreversível.</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => setShowDeleteModal(true)}
                                                className="w-full md:w-auto px-6 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-200 dark:shadow-none flex items-center justify-center gap-2"
                                            >
                                                <Trash2 size={14} /> Deletar Banco
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Folha de Pagamentos */}
                            {isAdmin && adminTab === 'payments' && (
                                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400">Folha de Fechamento</h4>
                                        <button onClick={generateAuditReport} className="flex items-center gap-2 text-[10px] font-black uppercase bg-black dark:bg-white text-white dark:text-black px-5 py-2.5 rounded-xl hover:shadow-lg transition-all">
                                            <Printer size={14}/> Relatório
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-50 dark:divide-slate-800">
                                        {Object.keys(stats.byUser).length > 0 ? Object.keys(stats.byUser).map((name) => {
                                            const data = stats.byUser[name];
                                            return (
                                            <div key={name} className="px-8 py-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center font-black uppercase text-xs">{name.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-sm font-black uppercase truncate max-w-[200px]">{name}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{data.items} peças</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-black tracking-tighter">R$ {data.total.toFixed(2)}</p>
                                                    <p className="text-[9px] font-black uppercase text-emerald-500">Auditado: R$ {data.toPay.toFixed(2)}</p>
                                                </div>
                                            </div>
                                        )}) : (
                                            <div className="text-center py-20 text-slate-300 font-black uppercase text-[10px]">Nenhum colaborador encontrado</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Histórico do Colaborador (Modo Utilizador) */}
                            {!isAdmin && (
                                <div className="space-y-6">
                                    {newExporter ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-800/50">
                                                    <p className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Ganho Hoje</p>
                                                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tighter">R$ {userStats.daily.toFixed(2)}</p>
                                                </div>
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-800/50">
                                                    <p className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Este Mês</p>
                                                    <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 tracking-tighter">R$ {userStats.monthly.toFixed(2)}</p>
                                                </div>
                                            </div>

                                            {myRecords.length > 0 ? myRecords.map(r => (
                                                <div key={r.id} className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-8 relative overflow-hidden transition-all hover:shadow-md">
                                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${r.verified ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                                                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 cursor-pointer" onClick={() => r.imageDataUrl && setSelectedImage(r.imageDataUrl)}>
                                                        {r.imageDataUrl ? <img src={r.imageDataUrl} className="w-full h-full object-cover" /> : <Package className="text-slate-200" size={28} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase border ${PRODUCT_DATA[r.product]?.color}`}>{r.product}</span>
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{r.timestamp?.toDate().toLocaleDateString('pt-BR')}</span>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <div>
                                                                <p className="text-2xl font-black tracking-tight">{r.quantity} un.</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Ref: {r.materialId}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-2xl font-black tracking-tighter">R$ {calculateValue(r.product, r.quantity).toFixed(2)}</p>
                                                                <p className={`text-[8px] font-black uppercase mt-1 ${r.verified ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                                                    {r.verified ? '✓ Auditado' : '○ Aguardando'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-24 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 text-center px-10">
                                                    <Package className="text-slate-200 dark:text-slate-800 mx-auto mb-6 opacity-20" size={48} />
                                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">A aguardar o teu primeiro registro.</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="py-24 bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800 text-center px-10">
                                            <User className="text-slate-200 dark:text-slate-800 mx-auto mb-6" size={48} />
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Identifica-te no formulário para veres o teu histórico.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Old footer admin login removed from here */}
            </main>

            {selectedImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-8 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} className="max-w-full max-h-[90vh] rounded-3xl shadow-2xl border border-white/10 object-contain" alt="Preview" />
                    <button className="absolute top-10 right-10 text-white bg-white/10 p-4 rounded-full hover:bg-white/20 transition-colors"><X size={32} /></button>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão de Banco */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full border border-rose-100 dark:border-rose-900 shadow-2xl">
                        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-lg font-black text-center text-slate-900 dark:text-white uppercase mb-2">Tem certeza?</h3>
                        <p className="text-xs text-center text-slate-400 dark:text-slate-500 font-bold uppercase mb-8 leading-relaxed">
                            Isso apagará permanentemente todos os registros de produção. Esta ação não pode ser desfeita.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 mb-1 block">Confirme a Senha Admin</label>
                                <input 
                                    type="password" 
                                    value={deletePasswordInput}
                                    onChange={(e) => setDeletePasswordInput(e.target.value)}
                                    placeholder="DIGITE A SENHA MESTRA"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 focus:ring-2 ring-rose-200 dark:ring-rose-900 outline-none font-black text-center uppercase tracking-widest text-xs"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => { setShowDeleteModal(false); setDeletePasswordInput(''); setDeleteFeedback(''); }}
                                    className="w-full py-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    disabled={isDeleting}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleDatabaseWipe}
                                    disabled={isDeleting}
                                    className="w-full py-4 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase hover:bg-rose-600 shadow-lg shadow-rose-200 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isDeleting ? (
                                        <>
                                           <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                                           Limpando...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 size={14} /> Confirmar
                                        </>
                                    )}
                                </button>
                            </div>
                            {deleteFeedback && (
                                <p className={`text-[10px] font-black uppercase text-center mt-4 ${deleteFeedback.includes('sucesso') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {deleteFeedback}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;