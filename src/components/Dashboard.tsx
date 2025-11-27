import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, Trash2, Save, X, Menu, Home, Settings, User, Download, Upload, Sun, Moon, Search as SearchIcon, ChevronRight, ChevronDown, GitBranch } from 'lucide-react';
import { Toast, type ToastType } from './Toast';

interface Calculation {
    id: string;
    name: string;
    negativo: number;
    cauzione: number;
    versamenti_settimanali: number;
    disponibilita: number;
    user_id: string;
    level?: Level;
    parent_id?: string | null;
}

type Level = 'master' | 'agente' | 'collaboratore' | 'pvr' | 'user';

interface EditableCellProps {
    value: string | number;
    type: 'text' | 'number';
    onSave: (value: string | number) => void;
    className?: string;
    validate?: (value: string | number) => string | null;
    onError: (message: string) => void;
}

function EditableCell({ value: initialValue, type, onSave, className, validate, onError }: EditableCellProps) {
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    const handleBlur = () => {
        if (value === initialValue) return;

        if (validate) {
            const error = validate(value);
            if (error) {
                onError(error);
                setValue(initialValue); // Revert
                return;
            }
        }

        onSave(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur();
        }
    };

    return (
        <input
            type={type}
            step={type === 'number' ? "0.01" : undefined}
            value={value}
            onChange={(e) => setValue(type === 'number' ? e.target.value : e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={className}
        />
    );
}

export function Dashboard({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
    const [data, setData] = useState<Calculation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<'home' | 'impostazioni' | 'profilo'>('home');
    const [showActions, setShowActions] = useState(false);
    const [importing, setImporting] = useState(false);
    const [csvEnabled, setCsvEnabled] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('csvEnabled') === 'true';
        }
        return false;
    });
    const [levels, setLevels] = useState<Record<string, Level>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('levels');
                return raw ? JSON.parse(raw) as Record<string, Level> : {};
            } catch {
                return {};
            }
        }
        return {};
    });
    const [parents, setParents] = useState<Record<string, string | null>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('parents');
                return raw ? JSON.parse(raw) as Record<string, string | null> : {};
            } catch {
                return {};
            }
        }
        return {};
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [editHierarchyId, setEditHierarchyId] = useState<string | null>(null);
    const [editLevel, setEditLevel] = useState<Level>('user');
    const [editParentId, setEditParentId] = useState<string>('');
    const [dbHierarchy, setDbHierarchy] = useState<boolean>(false);

    // New row state
    const [newName, setNewName] = useState('');
    const [newNegativo, setNewNegativo] = useState('');
    const [newCauzione, setNewCauzione] = useState('');
    const [newVersamenti, setNewVersamenti] = useState('');
    const [newDisponibilita, setNewDisponibilita] = useState('');
    const [newLevel, setNewLevel] = useState<Level>('user');
    const [newParentId, setNewParentId] = useState<string>('');

    const fetchData = useCallback(async () => {
        try {
            const { data: calculations, error } = await supabase
                .from('calculations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setData(calculations || []);
            const first: Partial<Calculation> | undefined = calculations && calculations.length ? calculations[0] : undefined;
            const has = Boolean(first && (first.level !== undefined || first.parent_id !== undefined));
            setDbHierarchy(has);
            if (has) {
                const lvlMap: Record<string, Level> = {};
                const pidMap: Record<string, string | null> = {};
                (calculations || []).forEach((r: Calculation) => {
                    lvlMap[r.id] = (r.level ?? (levels[r.id] ?? 'user')) as Level;
                    pidMap[r.id] = (r.parent_id ?? (parents[r.id] ?? null));
                });
                setLevels(lvlMap);
                setParents(pidMap);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [levels, parents]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('csvEnabled', String(csvEnabled));
        }
    }, [csvEnabled]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('levels', JSON.stringify(levels));
        }
    }, [levels]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('parents', JSON.stringify(parents));
        }
    }, [parents]);

    useEffect(() => {
        if (Object.keys(expanded).length === 0 && data.length > 0) {
            const next: Record<string, boolean> = {};
            data.forEach(r => { next[r.id] = true; });
            setExpanded(next);
        }
    }, [data, expanded]);

    useEffect(() => {
        const channel = supabase.channel('calculations_rt')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calculations' }, (payload) => {
                const row = payload.new as Calculation;
                setData(prev => [row, ...prev.filter(r => r.id !== row.id)]);
                if (row.level !== undefined) setLevels(prev => ({ ...prev, [row.id]: (row.level as Level) ?? (prev[row.id] ?? 'user') }));
                if ('parent_id' in row) setParents(prev => ({ ...prev, [row.id]: (row.parent_id ?? null) }));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calculations' }, (payload) => {
                const row = payload.new as Calculation;
                setData(prev => prev.map(r => r.id === row.id ? row : r));
                if (row.level !== undefined) setLevels(prev => ({ ...prev, [row.id]: (row.level as Level) ?? (prev[row.id] ?? 'user') }));
                if ('parent_id' in row) setParents(prev => ({ ...prev, [row.id]: (row.parent_id ?? null) }));
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'calculations' }, (payload) => {
                const oldRow = payload.old as { id: string };
                setData(prev => prev.filter(r => r.id !== oldRow.id));
                setLevels(prev => { const copy = { ...prev }; delete copy[oldRow.id]; return copy; });
                setParents(prev => { const copy = { ...prev }; delete copy[oldRow.id]; return copy; });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const calculateResult = (neg: number, cauz: number, vers: number) => {
        return neg + cauz + vers;
    };

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
    };

    const filteredData = (searchQuery.trim().length > 0)
        ? data.filter(row => String(row.name ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : data;

    const order: Level[] = ['master','agente','collaboratore','pvr','user'];
    
    const allowedParentLevels = (lvl: Level): Level[] => {
        if (lvl === 'agente') return ['master'];
        if (lvl === 'collaboratore') return ['master','agente'];
        if (lvl === 'pvr') return ['master','agente','collaboratore'];
        if (lvl === 'user') return ['master','agente','collaboratore','pvr'];
        return [];
    };
    const allowedChildLevels = (lvl: Level): Level[] => {
        const i = order.indexOf(lvl);
        return i >= 0 ? order.slice(i + 1) as Level[] : [];
    };
    const byId: Record<string, Calculation> = {};
    data.forEach(r => { byId[r.id] = r; });
    const childrenOf: Record<string, string[]> = {};
    data.forEach(r => { childrenOf[r.id] = []; });
    Object.entries(parents).forEach(([childId, pid]) => {
        if (pid) {
            childrenOf[pid] = childrenOf[pid] || [];
            childrenOf[pid].push(childId);
        }
    });
    const valueOf = (id: string) => {
        const r = byId[id];
        const n = Number(r?.negativo ?? 0);
        const c = Number(r?.cauzione ?? 0);
        const v = Number(r?.versamenti_settimanali ?? 0);
        const d = Number(r?.disponibilita ?? 0);
        const rr = calculateResult(n, c, v);
        return { n, c, v, d, rr };
    };
    const sumTree = (id: string) => {
        const base = valueOf(id);
        let negativo = base.n, cauzione = base.c, vers = base.v, disp = base.d, ris = base.rr;
        const kids = childrenOf[id] || [];
        kids.forEach(kid => {
            const s = sumTree(kid);
            negativo += s.negativo; cauzione += s.cauzione; vers += s.vers; disp += s.disp; ris += s.ris;
        });
        return { negativo, cauzione, vers, disp, ris };
    };
    const visibleList: Array<{ row: Calculation; depth: number }> = [];
    const collect = (id: string, lvl: Level, depth: number) => {
        const kids = childrenOf[id] || [];
        const allowed = allowedChildLevels(lvl);
        const allowedKids = kids
            .filter(cid => allowed.includes((levels[cid] ?? 'user')))
            .sort((a, b) => {
                const la = (levels[a] ?? 'user') as Level;
                const lb = (levels[b] ?? 'user') as Level;
                if (la === 'pvr' && lb !== 'pvr') return -1;
                if (la !== 'pvr' && lb === 'pvr') return 1;
                const ia = order.indexOf(la);
                const ib = order.indexOf(lb);
                return ia - ib;
            });
        allowedKids.forEach(cid => {
            const childRow = byId[cid];
            if (childRow) {
                visibleList.push({ row: childRow, depth: depth + 1 });
                const cl = (levels[cid] ?? 'user') as Level;
                if (expanded[cid]) collect(cid, cl, depth + 1);
            }
        });
    };
    const roots = data.filter(r => {
        const pid = parents[r.id];
        return !pid || !byId[pid];
    }).sort((a, b) => {
        const ia = order.indexOf(levels[a.id] ?? 'user');
        const ib = order.indexOf(levels[b.id] ?? 'user');
        return ia - ib;
    });
    roots.forEach(r => {
        const lvl = levels[r.id] ?? 'user';
        visibleList.push({ row: r, depth: 0 });
        if (expanded[r.id]) collect(r.id, lvl, 0);
    });
    const listToRender: Array<{ row: Calculation; depth: number }> = searchQuery.trim().length > 0
        ? filteredData.map(r => ({ row: r, depth: 0 }))
        : visibleList;

    

    const handleExportCsv = () => {
        const byId: Record<string, Calculation> = {};
        data.forEach(r => { byId[r.id] = r; });
        const headers = ['Utente', 'Livello', 'Padre', 'Negativo', 'Cauzione', 'Versamenti Settimanali', 'Disponibilità Conti Gioco', 'Risultato'];
        const rows = data.map(r => [
            String(r.name ?? '').toUpperCase(),
            String((levels[r.id] ?? 'user')).toUpperCase(),
            String(parents[r.id] ? String(byId[parents[r.id]!]?.name ?? '').toUpperCase() : ''),
            Number(r.negativo ?? 0).toFixed(2),
            Number(r.cauzione ?? 0).toFixed(2),
            Number(r.versamenti_settimanali ?? 0).toFixed(2),
            Number(r.disponibilita ?? 0).toFixed(2),
            Number(calculateResult(Number(r.negativo ?? 0), Number(r.cauzione ?? 0), Number(r.versamenti_settimanali ?? 0))).toFixed(2),
        ]);
        const csvBody = [headers.join(','), ...rows.map(row => row.map(v => {
            const s = String(v ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        }).join(','))].join('\n');
        const csv = '\uFEFF' + csvBody;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `esiti_settimanali_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseCsvLine = (line: string) => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += c;
            }
        }
        result.push(cur);
        return result;
    };

    const handleImportCsv = async (file: File) => {
        try {
            setImporting(true);
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length < 2) {
                showToast('File CSV vuoto o non valido', 'error');
                return;
            }
            const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
            const expected = ['name', 'negativo', 'cauzione', 'versamenti_settimanali', 'disponibilita'];
            const ok = expected.every(h => headers.includes(h));
            if (!ok) {
                showToast('Header CSV non valido', 'error');
                return;
            }
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) {
                showToast('Utente non autenticato', 'error');
                return;
            }
            const idx: Record<string, number> = {};
            headers.forEach((h, i) => { idx[h] = i; });
            const rows = lines.slice(1).map(line => parseCsvLine(line)).map(cols => {
                const base: (Omit<Calculation, 'id'> & { level?: Level; parent_id?: string | null }) = {
                    user_id: user.id,
                    name: cols[idx['name']] ?? '',
                    negativo: parseFloat((cols[idx['negativo']] ?? '0').replace(',', '.')) || 0,
                    cauzione: parseFloat((cols[idx['cauzione']] ?? '0').replace(',', '.')) || 0,
                    versamenti_settimanali: parseFloat((cols[idx['versamenti_settimanali']] ?? '0').replace(',', '.')) || 0,
                    disponibilita: parseFloat((cols[idx['disponibilita']] ?? '0').replace(',', '.')) || 0,
                };
                const lvlIdx = idx['level'];
                const pidIdx = idx['parent_id'];
                if (dbHierarchy) {
                    if (lvlIdx !== undefined) {
                        const lv = String(cols[lvlIdx] ?? '').toLowerCase();
                        if (['master','agente','collaboratore','pvr','user'].includes(lv)) base.level = lv as Level;
                    }
                    if (pidIdx !== undefined) {
                        const pv = cols[pidIdx];
                        base.parent_id = pv && pv.length ? pv : null;
                    }
                }
                return base;
            }).filter(r => String(r.name ?? '').trim().length > 0);
            if (rows.length === 0) {
                showToast('Nessuna riga valida da importare', 'error');
                return;
            }
            const { data: inserted, error } = await supabase
                .from('calculations')
                .insert(rows)
                .select();
            if (error) throw error;
            setData([...(inserted || []), ...data]);
            showToast('Import CSV completato', 'success');
        } catch {
            showToast('Errore durante l\'import CSV', 'error');
        } finally {
            setImporting(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const user = (await supabase.auth.getUser()).data.user;
            if (!user) return;

            if (!newName.trim()) {
                showToast('Il nome utente non può essere vuoto', 'error');
                return;
            }

            const newRow: (Omit<Calculation, 'id'> & { level?: Level; parent_id?: string | null }) = {
                user_id: user.id,
                name: newName,
                negativo: -(Math.abs(parseFloat(newNegativo) || 0)),
                cauzione: parseFloat(newCauzione) || 0,
                versamenti_settimanali: parseFloat(newVersamenti) || 0,
                disponibilita: parseFloat(newDisponibilita) || 0,
            };
            if (dbHierarchy) {
                newRow.level = newLevel;
                newRow.parent_id = newParentId || null;
            }

            const { data: inserted, error } = await supabase
                .from('calculations')
                .insert([newRow])
                .select()
                .single();

            if (error) throw error;

            setData([inserted, ...data]);
            setLevels(prev => ({ ...prev, [inserted.id]: (dbHierarchy ? (inserted.level as Level) ?? newLevel : newLevel) }));
            setParents(prev => ({ ...prev, [inserted.id]: (dbHierarchy ? (inserted.parent_id as string | null) ?? (newParentId || null) : (newParentId || null)) }));
            setIsAdding(false);
            resetForm();
            showToast('Voce aggiunta con successo', 'success');
        } catch (error) {
            console.error('Error adding row:', error);
            showToast('Errore durante il salvataggio', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa riga?')) return;
        try {
            const { error } = await supabase
                .from('calculations')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setData(data.filter(item => item.id !== id));
            showToast('Voce eliminata', 'success');
        } catch (error) {
            console.error('Error deleting row:', error);
            showToast('Errore durante l\'eliminazione', 'error');
        }
    };

    const handleUpdate = async (id: string, field: keyof Calculation, value: string | number) => {
        const isName = field === 'name';
        const numValue = typeof value === 'number' ? value : (parseFloat(String(value)) || 0);
        const nextValue: string | number = isName
            ? String(value)
            : (field === 'negativo' ? -(Math.abs(numValue)) : numValue);

        setData(data.map(item =>
            item.id === id ? { ...item, [field]: nextValue } : item
        ));

        try {
            const { error } = await supabase
                .from('calculations')
                .update({ [field]: nextValue })
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating row:', error);
            showToast('Errore durante l\'aggiornamento', 'error');
            fetchData(); // Revert
        }
    };

    const resetForm = () => {
        setNewName('');
        setNewNegativo('');
        setNewCauzione('');
        setNewVersamenti('');
        setNewDisponibilita('');
        setNewLevel('user');
        setNewParentId('');
    };

    const levelBadgeClass = (lvl: Level) => {
        if (theme === 'light') {
            if (lvl === 'master') return 'bg-indigo-600 text-white';
            if (lvl === 'agente') return 'bg-blue-600 text-white';
            if (lvl === 'collaboratore') return 'bg-teal-600 text-white';
            if (lvl === 'pvr') return 'bg-amber-600 text-slate-900';
            return 'bg-slate-700 text-white';
        } else {
            if (lvl === 'master') return 'bg-indigo-500 text-white';
            if (lvl === 'agente') return 'bg-blue-500 text-white';
            if (lvl === 'collaboratore') return 'bg-teal-500 text-white';
            if (lvl === 'pvr') return 'bg-amber-400 text-slate-900';
            return 'bg-slate-700 text-white';
        }
    };

    const levelRowBgClass = (lvl: Level) => {
        if (theme === 'light') {
            if (lvl === 'master') return 'bg-indigo-50';
            if (lvl === 'agente') return 'bg-blue-50';
            if (lvl === 'collaboratore') return 'bg-teal-50';
            if (lvl === 'pvr') return 'bg-amber-50';
            return 'bg-slate-50';
        } else {
            if (lvl === 'master') return 'bg-indigo-950/30';
            if (lvl === 'agente') return 'bg-blue-950/30';
            if (lvl === 'collaboratore') return 'bg-teal-950/30';
            if (lvl === 'pvr') return 'bg-amber-950/30';
            return 'bg-slate-800/30';
        }
    };

    const ancestorOfLevels = (id: string, targets: Level[]): { id: string; level: Level } | null => {
        let cur = parents[id] ?? null;
        while (cur) {
            const cl = (levels[cur] ?? 'user') as Level;
            if (targets.includes(cl)) return { id: cur, level: cl };
            cur = parents[cur] ?? null;
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-transparent">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <header className="bg-white dark:bg-[#2A3543] border-b border-slate-200 dark:border-[#2A3543] sticky top-0 z-10">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md flex items-center gap-2 text-sm font-medium`}>
                            <Menu className="w-5 h-5" />
                            <span>Menu</span>
                        </button>
                        <img src="/logo-vincitu.png" alt="Logo" className="h-12 w-auto object-contain" />
                        
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleTheme}
                            className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md`}
                            title="Tema"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            {theme === 'dark' ? 'Light' : 'Dark'}
                        </button>
                        <button
                            onClick={handleLogout}
                            className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md`}
                        >
                            <LogOut className="w-4 h-4" />
                            Esci
                        </button>
                    </div>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
            <div className="relative w-full max-w-xs">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca utente..."
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 outline-none transition-all ${theme === 'light' ? 'bg-white text-black border-slate-300' : 'bg-[#4B5563] text-white border-[#1F293B]'}`}
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setIsAdding(true)}
                    className="bg-[#1E43B8] hover:bg-[#1a3a9e] text-white border-[0.5px] border-[#888F96] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nuova Voce
                </button>
                
                
                <button
                    onClick={async () => {
                        const ExcelJS = await import('exceljs');
                        const wb = new ExcelJS.Workbook();
                        const ws = wb.addWorksheet('Esiti Settimanali');
                        ws.columns = [
                            { header: 'Livello', key: 'livello', width: 16 },
                            { header: 'Utente', key: 'utente', width: 32 },
                            { header: 'Negativo', key: 'negativo', width: 14 },
                            { header: 'Cauzione', key: 'cauzione', width: 14 },
                            { header: 'Versamenti Settimanali', key: 'vers', width: 22 },
                            { header: 'Disponibilità Conti Gioco', key: 'disp', width: 28 },
                            { header: 'Risultato', key: 'ris', width: 14 },
                        ];

                        const byId: Record<string, Calculation> = {};
                        data.forEach(r => { byId[r.id] = r; });

                        const childrenOf: Record<string, string[]> = {};
                        Object.keys(parents).forEach(childId => {
                            const pid = parents[childId];
                            if (pid) {
                                childrenOf[pid] = childrenOf[pid] || [];
                                childrenOf[pid].push(childId);
                            }
                        });

                        const valueOf = (id: string) => {
                            const r = byId[id];
                            const n = Number(r?.negativo ?? 0);
                            const c = Number(r?.cauzione ?? 0);
                            const v = Number(r?.versamenti_settimanali ?? 0);
                            const d = Number(r?.disponibilita ?? 0);
                            const rr = calculateResult(n, c, v);
                            return { n, c, v, d, rr };
                        };

                        const sumTree = (id: string) => {
                            const base = valueOf(id);
                            let negativo = base.n, cauzione = base.c, vers = base.v, disp = base.d, ris = base.rr;
                            const kids = childrenOf[id] || [];
                            kids.forEach(kid => {
                                const s = sumTree(kid);
                                negativo += s.negativo; cauzione += s.cauzione; vers += s.vers; disp += s.disp; ris += s.ris;
                            });
                            return { negativo, cauzione, vers, disp, ris };
                        };

                        

                        const indent = (s: string, times: number) => ' '.repeat(Math.max(0, times) * 2) + s;

                        const write = (id: string, depth: number) => {
                            const lvl = String((levels[id] ?? 'user')).toUpperCase();
                            const name = String(byId[id]?.name ?? '').toUpperCase();
                            const kids = childrenOf[id] || [];
                            if (kids.length > 0) {
                                const tot = sumTree(id);
                                const row = ws.addRow({ livello: lvl, utente: indent(name, depth), negativo: tot.negativo, cauzione: tot.cauzione, vers: tot.vers, disp: tot.disp, ris: tot.ris });
                                row.font = { bold: true };
                            } else {
                                const base = valueOf(id);
                                ws.addRow({ livello: lvl, utente: indent(name, depth), negativo: base.n, cauzione: base.c, vers: base.v, disp: base.d, ris: base.rr });
                            }
                            kids.forEach(k => write(k, depth + 1));
                        };

                        const roots = data.filter(r => {
                            const pid = parents[r.id];
                            return !pid || !byId[pid];
                        });
                        roots.forEach(r => write(r.id, 0));

                        const header = ws.getRow(1);
                        header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E43B8' } };
                        header.alignment = { vertical: 'middle', horizontal: 'center' };
                        ws.eachRow(row => {
                            row.eachCell(cell => {
                                cell.border = {
                                    top: { style: 'thin', color: { argb: 'FF888F96' } },
                                    left: { style: 'thin', color: { argb: 'FF888F96' } },
                                    bottom: { style: 'thin', color: { argb: 'FF888F96' } },
                                    right: { style: 'thin', color: { argb: 'FF888F96' } },
                                };
                                if (typeof cell.value === 'number') {
                                    cell.numFmt = '#,##0.00';
                                    cell.alignment = { horizontal: 'right' };
                                }
                            });
                        });
                        const buf = await wb.xlsx.writeBuffer();
                        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `esiti_settimanali_${new Date().toISOString().slice(0,10)}.xlsx`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="bg-[#079765] hover:bg-[#067a51] text-white border-[0.5px] border-[#888F96] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Esporta EXCEL
                </button>
                <button
                    onClick={handleExportCsv}
                    disabled={!csvEnabled}
                    className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Download className="w-4 h-4" />
                    Esporta CSV
                </button>
                <label className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm cursor-pointer`}>
                    <Upload className="w-4 h-4" />
                    Importa CSV
                    <input
                        type="file"
                                accept=".csv"
                                className="sr-only"
                                onChange={(ev) => {
                                    const f = ev.target.files?.[0];
                                    if (f) handleImportCsv(f);
                                    ev.currentTarget.value = '';
                                }}
                                disabled={importing}
                            />
                        </label>
                    </div>
                </div>

                {/* Add Form Modal/Overlay */}
                {isAdding && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Aggiungi Nuova Voce</h3>
                                <button onClick={() => setIsAdding(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleAdd} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white uppercase mb-1">Utente</label>
                    <input
                        type="text"
                        required
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                        placeholder="Nome utente"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-white uppercase mb-1">Livello</label>
                    <select
                        value={newLevel}
                        onChange={(e) => { const v = e.target.value as Level; setNewLevel(v); setNewParentId(''); }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white"
                    >
                        <option value="master">Master</option>
                        <option value="agente">Agente</option>
                        <option value="collaboratore">Collaboratore</option>
                        <option value="pvr">PVR</option>
                        <option value="user">User</option>
                    </select>
                </div>
                {(['agente','collaboratore','pvr','user'] as Level[]).includes(newLevel) && (
                    <div>
                        <label className="block text-xs font-semibold text-white uppercase mb-1">Appartiene a</label>
                        <select
                            value={newParentId}
                            onChange={(e) => setNewParentId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white"
                        >
                            <option value="">Seleziona</option>
                            {data.filter(d => allowedParentLevels(newLevel).includes(levels[d.id] ?? 'user')).sort((a,b) => {
                                const la = order.indexOf(levels[a.id] ?? 'user');
                                const lb = order.indexOf(levels[b.id] ?? 'user');
                                return la - lb;
                            }).map(d => (
                                <option key={d.id} value={d.id}>{String(d.name ?? '').toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                )}
                                <div>
                                    <label className="block text-xs font-semibold text-white uppercase mb-1">Negativo</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newNegativo}
                                        onChange={e => setNewNegativo(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white uppercase mb-1">Cauzione</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newCauzione}
                                        onChange={e => setNewCauzione(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white uppercase mb-1">Vers. Settimanali</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newVersamenti}
                                        onChange={e => setNewVersamenti(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-white uppercase mb-1">Disponibilità</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newDisponibilita}
                                        onChange={e => setNewDisponibilita(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="col-span-2 flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdding(false)}
                                        className={`px-4 py-2 ${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] rounded-lg font-medium transition-colors`}
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className={`px-4 py-2 ${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#1E43B8] hover:bg-[#1a3a9e]'} text-white rounded-lg font-medium transition-colors flex items-center gap-2`}
                                    >
                                        <Save className="w-4 h-4" />
                                        Salva
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Hierarchy Modal */}
                {editHierarchyId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Modifica Livello e Appartenenza</h3>
                                <button onClick={() => setEditHierarchyId(null)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={async (e) => { e.preventDefault(); try { if (dbHierarchy) { const { error } = await supabase.from('calculations').update({ level: editLevel, parent_id: editParentId || null }).eq('id', editHierarchyId!); if (error) throw error; } setLevels(prev => ({ ...prev, [editHierarchyId!]: editLevel })); setParents(prev => ({ ...prev, [editHierarchyId!]: editParentId || null })); setEditHierarchyId(null); showToast('Gerarchia aggiornata', 'success'); } catch (err) { console.error('Error updating hierarchy:', err); showToast('Errore aggiornando gerarchia. Verifica colonne DB.', 'error'); } }} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-white uppercase mb-1">Livello</label>
                                    <select
                                        value={editLevel}
                                        onChange={(e) => { const v = e.target.value as Level; setEditLevel(v); setEditParentId(''); }}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white"
                                    >
                                        <option value="master">Master</option>
                                        <option value="agente">Agente</option>
                                        <option value="collaboratore">Collaboratore</option>
                                        <option value="pvr">PVR</option>
                                        <option value="user">User</option>
                                    </select>
                                </div>
                                {(['agente','collaboratore','pvr','user'] as Level[]).includes(editLevel) && (
                                    <div>
                                        <label className="block text-xs font-semibold text-white uppercase mb-1">Appartiene a</label>
                                        <select
                                            value={editParentId}
                                            onChange={(e) => setEditParentId(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white"
                                        >
                                            <option value="">Seleziona</option>
                                            {data.filter(d => allowedParentLevels(editLevel).includes(levels[d.id] ?? 'user')).sort((a,b) => {
                                                const la = order.indexOf(levels[a.id] ?? 'user');
                                                const lb = order.indexOf(levels[b.id] ?? 'user');
                                                return la - lb;
                                            }).map(d => (
                                                <option key={d.id} value={d.id}>{String(d.name ?? '').toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="col-span-2 flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setEditHierarchyId(null)}
                                        className={`px-4 py-2 ${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] rounded-lg font-medium transition-colors`}
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className={`px-4 py-2 ${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#1E43B8] hover:bg-[#1a3a9e]'} text-white rounded-lg font-medium transition-colors flex items-center gap-2`}
                                    >
                                        <Save className="w-4 h-4" />
                                        Salva
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="fixed inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
                        <div className="relative z-10 w-64 h-full bg-slate-900 text-white shadow-2xl">
                            <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800">
                                <span className="font-semibold">Menu</span>
                                <button onClick={() => setSidebarOpen(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="py-2">
                                <button onClick={() => setActiveMenu('home')} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800 ${activeMenu === 'home' ? 'bg-slate-800' : ''}`}>
                                    <Home className="w-4 h-4" />
                                    Home
                                </button>
                                <button onClick={() => setActiveMenu('impostazioni')} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800 ${activeMenu === 'impostazioni' ? 'bg-slate-800' : ''}`}>
                                    <Settings className="w-4 h-4" />
                                    Impostazioni
                                </button>
                                <button onClick={() => setActiveMenu('profilo')} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800 ${activeMenu === 'profilo' ? 'bg-slate-800' : ''}`}>
                                    <User className="w-4 h-4" />
                                    Profilo
                                </button>
                            </nav>
                            {activeMenu === 'impostazioni' && (
                                <div className="px-4 py-4 border-t border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm">Colonna Azioni</span>
                                        <label className="relative inline-flex items-center w-12 h-6 cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={showActions} onChange={(e) => setShowActions(e.target.checked)} />
                                            <span className="block w-12 h-6 rounded-full bg-slate-700 transition-colors peer-checked:bg-green-500"></span>
                                            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6"></span>
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Di default è disabilitata.</p>
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-sm">Button Esporta CSV</span>
                                        <label className="relative inline-flex items-center w-12 h-6 cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={csvEnabled} onChange={(e) => setCsvEnabled(e.target.checked)} />
                                            <span className="block w-12 h-6 rounded-full bg-slate-700 transition-colors peer-checked:bg-green-500"></span>
                                            <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6"></span>
                                        </label>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Di default è disabilitato.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-[#1F293B] text-white rounded-xl shadow-sm border border-[#1F293B] overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-green-800 dark:bg-emerald-900 border-b border-green-900 dark:border-emerald-950">
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider">Livello</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider">Utente</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right">Negativo</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right">Cauzione</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right">Vers. Sett.</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right">Disponibilità Conti Gioco</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right">Risultato</th>
                                    {showActions && (
                                        <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">Azioni</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={showActions ? 8 : 7} className="px-6 py-8 text-center text-slate-400">
                                            Caricamento...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={showActions ? 8 : 7} className="px-6 py-8 text-center text-slate-400">
                                            Nessun dato presente. Aggiungi una nuova voce.
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={showActions ? 8 : 7} className="px-6 py-8 text-center text-slate-400">
                                            Nessun risultato per "{searchQuery}"
                                        </td>
                                    </tr>
                                ) : (
                                    listToRender.map(({ row, depth }) => {
                                        const hasChildren = (childrenOf[row.id] || []).length > 0;
                                        const totals = hasChildren ? sumTree(row.id) : null;
                                        const rowLevel = (levels[row.id] ?? 'user') as Level;
                                        const owner = rowLevel === 'pvr' ? ancestorOfLevels(row.id, ['agente','master']) : null;
                                        return (
                                        <tr key={row.id} className={`${levelRowBgClass(rowLevel)} hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group`}>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-1 text-xs rounded ${levelBadgeClass(levels[row.id] ?? 'user')}`}>{(levels[row.id] ?? 'user').toUpperCase()}</span>
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'} uppercase`} title={owner ? `Appartiene a: ${(byId[owner.id]?.name ?? '').toUpperCase()} (${owner.level.toUpperCase()})` : undefined}>
                                                <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
                                                    {((childrenOf[row.id] || []).length > 0) ? (
                                                        <button
                                                            onClick={() => setExpanded(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                                            className="p-1 rounded hover:bg-slate-700"
                                                            aria-label={expanded[row.id] ? 'Comprimi' : 'Espandi'}
                                                        >
                                                            {expanded[row.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                        </button>
                                                    ) : (
                                                        <span className="inline-block w-4 h-4" />
                                                    )}
                                                <EditableCell
                                                    type="text"
                                                    value={row.name}
                                                    onSave={(val) => handleUpdate(row.id, 'name', val)}
                                                    validate={(val) => (!val || val.toString().trim() === '') ? 'Il nome non può essere vuoto' : null}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm font-medium ${theme === 'light' ? 'text-black' : 'text-white'} uppercase outline-none transition-all`}
                                                />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-red-400">
                                                {hasChildren ? (
                                                    <span className="font-mono block text-right">{totals!.negativo.toFixed(2)}</span>
                                                ) : (
                                                    <EditableCell
                                                        type="number"
                                                        value={row.negativo}
                                                        onSave={(val) => handleUpdate(row.id, 'negativo', val)}
                                                        onError={(msg) => showToast(msg, 'error')}
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm text-red-400 text-right font-mono outline-none transition-all"
                                                    />
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                                                {hasChildren ? (
                                                    <span className="font-mono block text-right">{totals!.cauzione.toFixed(2)}</span>
                                                ) : (
                                                    <EditableCell
                                                        type="number"
                                                        value={row.cauzione}
                                                        onSave={(val) => handleUpdate(row.id, 'cauzione', val)}
                                                        onError={(msg) => showToast(msg, 'error')}
                                                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm ${theme === 'light' ? 'text-black' : 'text-white'} text-right font-mono outline-none transition-all`}
                                                    />
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                                                {hasChildren ? (
                                                    <span className="font-mono block text-right">{totals!.vers.toFixed(2)}</span>
                                                ) : (
                                                    <EditableCell
                                                        type="number"
                                                        value={row.versamenti_settimanali}
                                                        onSave={(val) => handleUpdate(row.id, 'versamenti_settimanali', val)}
                                                        onError={(msg) => showToast(msg, 'error')}
                                                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm ${theme === 'light' ? 'text-black' : 'text-white'} text-right font-mono outline-none transition-all`}
                                                    />
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                                                {hasChildren ? (
                                                    <span className="font-mono block text-right">{totals!.disp.toFixed(2)}</span>
                                                ) : (
                                                    <EditableCell
                                                        type="number"
                                                        value={row.disponibilita}
                                                        onSave={(val) => handleUpdate(row.id, 'disponibilita', val)}
                                                        onError={(msg) => showToast(msg, 'error')}
                                                        className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm ${theme === 'light' ? 'text-black' : 'text-white'} text-right font-mono outline-none transition-all`}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-[#3B82F6] text-right bg-slate-50/30 dark:bg-slate-800/30 font-mono">
                                                {(hasChildren ? totals!.ris : calculateResult(row.negativo, row.cauzione, row.versamenti_settimanali)).toFixed(2)}
                                            </td>
                                            {showActions && (
                                            <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => handleDelete(row.id)}
                                                        className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] transition-colors p-1 rounded-md`}
                                                        title="Elimina"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditHierarchyId(row.id); setEditLevel(levels[row.id] ?? 'user'); setEditParentId(parents[row.id] ?? ''); }}
                                                        className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] transition-colors p-1 rounded-md ml-2`}
                                                        title="Modifica gerarchia"
                                                    >
                                                        <GitBranch className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
