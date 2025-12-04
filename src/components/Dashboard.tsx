import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, Trash2, Save, X, Menu, Home, Settings, User, Users, Download, Upload, Sun, Moon, Search as SearchIcon, ChevronRight, ChevronDown, GitBranch, Check, Minus, Shield, Wallet, Calculator } from 'lucide-react';
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
    const [activeMenu, setActiveMenu] = useState<'home' | 'impostazioni' | 'profilo' | 'inviti'>('home');
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    const [usersModalOpen, setUsersModalOpen] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileFirstName, setProfileFirstName] = useState('');
    const [profileLastName, setProfileLastName] = useState('');
    const [profileBirthDate, setProfileBirthDate] = useState<string>('');
    const [profileInviteCode, setProfileInviteCode] = useState<string>('');
    const [profileRegisteredAt, setProfileRegisteredAt] = useState<string>('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [userFirstName, setUserFirstName] = useState('');
    const [userLastName, setUserLastName] = useState('');
    type AppRole = 'admin' | 'user';
    const [appUsers, setAppUsers] = useState<Array<{ id: string; email: string; role: AppRole; active?: boolean; created_at?: string }>>([]);
    const [inviteCodes, setInviteCodes] = useState<Array<{ id: string; code: string; active?: boolean; used_at?: string | null; used_by?: string | null }>>([]);
    const [newInviteCode, setNewInviteCode] = useState('');
    const [newInviteActive, setNewInviteActive] = useState(true);
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

    const [versInclude, setVersInclude] = useState<Record<string, boolean>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('versInclude');
                return raw ? JSON.parse(raw) as Record<string, boolean> : {};
            } catch {
                return {};
            }
        }
        return {};
    });
    

    // New row state
    const [newName, setNewName] = useState('');
    const [newNegativo, setNewNegativo] = useState('');
    const [newCauzione, setNewCauzione] = useState('');
    const [newVersamenti, setNewVersamenti] = useState('');
    const [newDisponibilita, setNewDisponibilita] = useState('');
    const [newLevel, setNewLevel] = useState<Level>('user');
    const [newParentId, setNewParentId] = useState<string>('');
    const [newVersInclude, setNewVersInclude] = useState<boolean>(true);
    const [selectedHierarchyId, setSelectedHierarchyId] = useState<string | null>(null);
    const [hierarchyBarOpen, setHierarchyBarOpen] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            const raw = localStorage.getItem('hierarchyBarOpen');
            return raw ? raw === 'true' : true;
        }
        return true;
    });

    const expandAllUnder = useCallback((rootId: string) => {
        const visit = (id: string) => {
            setExpanded(prev => ({ ...prev, [id]: true }));
            const kids = Object.keys(parents).filter(cid => parents[cid] === id);
            kids.forEach(k => visit(k));
        };
        visit(rootId);
    }, [parents]);

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

    const fetchInviteCodes = useCallback(async () => {
        try {
            const { data: codes, error } = await supabase
                .from('invite_codes')
                .select('id, code, active, used_at, used_by')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setInviteCodes(codes || []);
        } catch (err) {
            console.error('Error fetching invite codes:', err);
        }
    }, []);

    const genInviteCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `${part()}-${part()}-${part()}`;
    };

    const fetchAppUsers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('app_users')
                .select('id, email, role, active, created_at')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setAppUsers((data || []).map(u => ({ id: u.id as string, email: String(u.email ?? ''), role: (u.role as AppRole) ?? 'user', active: Boolean(u.active), created_at: String(u.created_at ?? '') })));
        } catch (err) {
            console.error('Error fetching app users:', err);
        }
    }, []);

    const cleanupSampleUsers = useCallback(async () => {
        try {
            const samples = ['user@example.com','demo@example.com','test@example.com','admin@example.com','example@example.com'];
            const { data } = await supabase
                .from('app_users')
                .select('id,email')
                .in('email', samples);
            if (data && data.length > 0) {
                const { error } = await supabase.from('app_users').delete().in('email', samples);
                if (error) throw error;
                await fetchAppUsers();
                showToast('Utenze di esempio rimosse', 'success');
            }
        } catch (err) {
            console.error(err);
        }
    }, [fetchAppUsers]);

    const fetchProfile = useCallback(async () => {
        try {
            setProfileLoading(true);
            const { data: userData } = await supabase.auth.getUser();
            const user = userData?.user;
            if (user) {
                setProfileRegisteredAt(user.created_at ?? '');
                const email = user.email ?? '';
                if (email) {
                    const { data: codes } = await supabase
                        .from('invite_codes')
                        .select('*')
                        .eq('used_by', email)
                        .order('used_at', { ascending: false })
                        .limit(1);
                    if (codes && codes.length > 0) {
                        setProfileInviteCode(String(codes[0].code ?? ''));
                    } else {
                        setProfileInviteCode('');
                    }
                }
                const { data: appUserRows } = await supabase
                    .from('app_users')
                    .select('*')
                    .eq('id', user.id)
                    .limit(1);
                const row = (appUserRows && appUserRows[0]) as { first_name?: string | null; last_name?: string | null; birth_date?: string | null } | undefined;
                setProfileFirstName(String(row?.first_name ?? ''));
                setProfileLastName(String(row?.last_name ?? ''));
                setUserFirstName(String(row?.first_name ?? ''));
                setUserLastName(String(row?.last_name ?? ''));
                const bd = row?.birth_date;
                setProfileBirthDate(bd ? String(bd).substring(0, 10) : '');
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setProfileLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        cleanupSampleUsers();
    }, [cleanupSampleUsers]);

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
        if (typeof window !== 'undefined') {
            localStorage.setItem('versInclude', JSON.stringify(versInclude));
        }
    }, [versInclude]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('hierarchyBarOpen', String(hierarchyBarOpen));
        }
    }, [hierarchyBarOpen]);

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
        const includeVers = versInclude[id] !== false;
        const v = includeVers ? Number(r?.versamenti_settimanali ?? 0) : 0;
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
    const collect = (acc: Array<{ row: Calculation; depth: number }>, id: string, lvl: Level, depth: number) => {
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
                acc.push({ row: childRow, depth: depth + 1 });
                const cl = (levels[cid] ?? 'user') as Level;
                if (expanded[cid]) collect(acc, cid, cl, depth + 1);
            }
        });
    };
    const computeVisible = () => {
        const res: Array<{ row: Calculation; depth: number }> = [];
        if (selectedHierarchyId) {
            const r = byId[selectedHierarchyId];
            if (r) {
                res.push({ row: r, depth: 0 });
                const lvl = (levels[r.id] ?? 'user') as Level;
                if (expanded[r.id]) collect(res, r.id, lvl, 0);
            }
            return res;
        }
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
            res.push({ row: r, depth: 0 });
            if (expanded[r.id]) collect(res, r.id, lvl, 0);
        });
        return res;
    };
    const visibleList = computeVisible();
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
            Number(valueOf(r.id).rr).toFixed(2),
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
            setVersInclude(prev => ({ ...prev, [inserted.id]: newVersInclude }));
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
        setData(data.map(item => item.id === id ? { ...item, [field]: nextValue } : item));

        try {
            const { error } = await supabase
                .from('calculations')
                .update({ [field]: nextValue })
                .eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating row:', error);
            showToast('Errore durante l\'aggiornamento', 'error');
            fetchData();
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
        setNewVersInclude(true);
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
                        <button onClick={() => setSidebarOpen(true)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md flex items-center gap-1 sm:gap-2 text-sm font-medium`}>
                            <Menu className="w-5 h-5" />
                            <span className="hidden sm:inline">Menu</span>
                        </button>
                        <img src="/logo-vincitu.png" alt="Logo" className="h-12 w-auto object-contain" />
                        
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                        {(userFirstName || userLastName) && (
                            <span className={`hidden md:inline ${theme === 'light' ? 'text-black' : 'text-white'} text-sm px-2`}>
                                Benvenuto {userFirstName} {userLastName}
                            </span>
                        )}
                        <button
                            onClick={onToggleTheme}
                            className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md`}
                            title="Tema"
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>
                        <button
                            onClick={handleLogout}
                            className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md`}
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Esci</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
                {/* Actions */}
            <div className="mb-6 flex justify-between items-center">
            <div className="relative w-full max-w-[11rem] sm:max-w-xs">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca utente..."
                    className={`w-full pl-8 sm:pl-9 pr-2 sm:pr-3 py-1.5 sm:py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 outline-none transition-all text-sm sm:text-base ${theme === 'light' ? 'bg-white text-black border-slate-300' : 'bg-[#4B5563] text-white border-[#1F293B]'}`}
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => { setIsAdding(true); showToast('Modulo Nuova Voce aperto', 'success'); }}
                    className="bg-[#1E43B8] hover:bg-[#1a3a9e] text-white border-[0.5px] border-[#888F96] px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuova Voce</span>
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
                            const includeVers = versInclude[id] !== false;
                            const v = includeVers ? Number(r?.versamenti_settimanali ?? 0) : 0;
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

                        

                        const tableRows: Array<[string, string, number, number, number, number, number]> = [];
                        const rowDepths: number[] = [];
                        const rowHasChildren: boolean[] = [];
                        

                        const write = (id: string, depth: number) => {
                            const lvl = String((levels[id] ?? 'user')).toUpperCase();
                            const name = String(byId[id]?.name ?? '').toUpperCase();
                            const kids = childrenOf[id] || [];
                            if (kids.length > 0) {
                                const tot = sumTree(id);
                                const base = valueOf(id);
                                tableRows.push([lvl, name, tot.negativo, base.c, tot.vers, tot.disp, tot.ris]);
                                rowDepths.push(depth);
                                rowHasChildren.push(true);
                            } else {
                                const base = valueOf(id);
                                tableRows.push([lvl, name, base.n, base.c, base.v, base.d, base.rr]);
                                rowDepths.push(depth);
                                rowHasChildren.push(false);
                            }
                            kids.forEach(k => write(k, depth + 1));
                        };

                        const rootsIds: string[] = selectedHierarchyId ? [selectedHierarchyId] : data.filter(r => {
                            const pid = parents[r.id];
                            return !pid || !byId[pid];
                        }).map(r => r.id);
                        rootsIds.forEach(id => write(id, 0));
                        ws.addTable({
                            name: 'EsitiSettimanali',
                            ref: 'A1',
                            headerRow: true,
                            style: { theme: 'TableStyleMedium2', showRowStripes: true },
                            columns: [
                                { name: 'Livello', filterButton: true },
                                { name: 'Utente', filterButton: true },
                                { name: 'Negativo', filterButton: true },
                                { name: 'Cauzione', filterButton: true },
                                { name: 'Versamenti Settimanali', filterButton: true },
                                { name: 'Disponibilità Conti Gioco', filterButton: true },
                                { name: 'Risultato', filterButton: true },
                            ],
                            rows: tableRows,
                        });

                        const header = ws.getRow(1);
                        header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E43B8' } };
                        header.alignment = { vertical: 'middle', horizontal: 'center' };

                        const maxDepth = Math.max(0, ...rowDepths);
                        ws.properties.outlineLevelRow = maxDepth;
                        ws.eachRow((row, rowNumber) => {
                            row.eachCell((cell) => {
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
                            if (rowNumber > 1) {
                                const idx = rowNumber - 2;
                                const d = rowDepths[idx] || 0;
                                row.outlineLevel = Math.min(d, 7);
                                const nameCell = row.getCell(2);
                                nameCell.alignment = { indent: Math.min(d, 7) };
                                if (rowHasChildren[idx]) {
                                    row.font = { bold: true };
                                }
                            }
                        });
                        const buf = await wb.xlsx.writeBuffer();
                        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        {
                            const today = new Date().toISOString().slice(0,10);
                            let prefix = 'tutti';
                            if (selectedHierarchyId) {
                                const lvl = String((levels[selectedHierarchyId] ?? 'user')).toLowerCase();
                                const nm = String(byId[selectedHierarchyId]?.name ?? '').toLowerCase();
                                const safeNm = nm
                                    .normalize('NFD')
                                    .replace(/[\u0300-\u036f]/g, '')
                                    .replace(/[^a-z0-9]+/g, '_')
                                    .replace(/^_+|_+$/g, '');
                                prefix = `${safeNm}_${lvl}`;
                            }
                            a.download = `${prefix}_esiti_settimanali_${today}.xlsx`;
                        }
                        a.click();
                        URL.revokeObjectURL(url);
                    }}
                    className="bg-[#079765] hover:bg-[#067a51] text-white border-[0.5px] border-[#888F96] px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Esporta EXCEL</span>
                </button>
                <button
                    onClick={handleExportCsv}
                    disabled={!csvEnabled}
                    className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Esporta CSV</span>
                </button>
                <label className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm cursor-pointer`}>
                    <Upload className="w-4 h-4" />
                    <span className="hidden sm:inline">Importa CSV</span>
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
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={newVersamenti}
                            onChange={e => setNewVersamenti(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-[#4B5563] text-white placeholder:text-white"
                            placeholder="0.00"
                        />
                        <button
                            type="button"
                            onClick={() => setNewVersInclude(!newVersInclude)}
                            className={`${newVersInclude ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'} text-white px-3 py-2 rounded-md text-xs font-medium transition-colors`}
                            title={newVersInclude ? 'Incluso nel calcolo' : 'Escluso dal calcolo'}
                        >
                            {newVersInclude ? 'Inclusa' : 'Esclusa'}
                        </button>
                    </div>
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

            <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40">
                <div className={`${theme === 'light' ? 'bg-white/90 border-[#1E43B8]' : 'bg-[#1F293B]/90 border-white'} backdrop-blur-sm border px-3 py-2 rounded-2xl shadow-lg flex items-center justify-center gap-2 overflow-x-auto w-full max-w-full md:max-w-[90vw] flex-wrap`}>
                    <button
                        onClick={() => setHierarchyBarOpen(!hierarchyBarOpen)}
                        className={`${theme === 'light' ? 'bg-slate-200 text-black' : 'bg-[#4B5563] text-white'} border-[0.5px] border-[#888F96] p-1.5 rounded-md text-xs font-medium`}
                        title={hierarchyBarOpen ? 'Nascondi barra' : 'Mostra barra'}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform ${hierarchyBarOpen ? '' : 'rotate-180'}`} />
                    </button>
                    {hierarchyBarOpen && (
                        <>
                            {data.filter(d => ['master','agente','collaboratore'].includes((levels[d.id] ?? 'user'))).sort((a,b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))).map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => { setSelectedHierarchyId(d.id); expandAllUnder(d.id); }}
                                    className={`${selectedHierarchyId === d.id ? 'bg-[#1E43B8] text-white' : (theme === 'light' ? 'bg-slate-200 text-black' : 'bg-[#4B5563] text-white')} border-[0.5px] border-[#888F96] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap`}
                                    title={`Mostra gerarchia di ${(String(d.name ?? '')).toUpperCase()}`}
                                >
                                    {(String(d.name ?? '')).toUpperCase()}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedHierarchyId(null)}
                                className={`${theme === 'light' ? 'bg-slate-200 text-black' : 'bg-[#4B5563] text-white'} border-[0.5px] border-[#888F96] px-3 py-1.5 rounded-md text-xs font-medium`}
                                title="Mostra tutti"
                            >
                                Tutti
                            </button>
                        </>
                    )}
                </div>
            </div>

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

                {inviteModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Gestione Codici Invito</h3>
                                <button onClick={() => setInviteModalOpen(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <input
                                        type="text"
                                        value={newInviteCode}
                                        onChange={(e) => setNewInviteCode(e.target.value)}
                                        placeholder="Nuovo codice"
                                        className="w-full sm:flex-1 px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white"
                                    />
                                    <label className="relative inline-flex items-center w-12 h-6 cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={newInviteActive} onChange={(e) => setNewInviteActive(e.target.checked)} />
                                        <span className="block w-12 h-6 rounded-full bg-slate-700 transition-colors peer-checked:bg-green-500"></span>
                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6"></span>
                                    </label>
                                    <button
                                        onClick={async () => { try { const { error } = await supabase.from('invite_codes').insert([{ code: newInviteCode, active: newInviteActive }]).select('*'); if (error) throw error; setNewInviteCode(''); setNewInviteActive(true); await fetchInviteCodes(); showToast('Codice creato', 'success'); } catch (err) { console.error(err); showToast('Errore creando codice', 'error'); } }}
                                        className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
                                    >
                                        Aggiungi
                                    </button>
                                    <button
                                        onClick={() => setNewInviteCode(genInviteCode())}
                                        className="px-3 py-2 rounded-md bg-[#555D69] text-white text-sm"
                                    >
                                        Genera
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                    {inviteCodes.map(c => (
                                        <div key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-2 rounded-md bg-slate-900 border border-slate-800">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-mono">{c.code}</span>
                                                <span className={`text-xs px-2 py-1 rounded ${c.active ? 'bg-green-700 text-white' : 'bg-slate-700 text-white'}`}>{c.active ? 'Attivo' : 'Inattivo'}</span>
                                                {c.used_at && <span className="text-xs text-slate-400">Usato: {new Date(c.used_at).toLocaleDateString()}</span>}
                                                {c.used_by && <span className="text-xs text-slate-400">Da: {c.used_by}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                                <button
                                                    onClick={async () => { try { const { error } = await supabase.from('invite_codes').update({ active: !c.active }).eq('id', c.id); if (error) throw error; await fetchInviteCodes(); } catch (err) { console.error(err); showToast('Errore aggiornando', 'error'); } }}
                                                    className="px-2 py-1 rounded-md bg-[#555D69] text-white text-xs"
                                                >
                                                    {c.active ? 'Disattiva' : 'Attiva'}
                                                </button>
                                                <button
                                                    onClick={async () => { if (!confirm('Eliminare il codice?')) return; try { const { error } = await supabase.from('invite_codes').delete().eq('id', c.id); if (error) throw error; await fetchInviteCodes(); } catch (err) { console.error(err); showToast('Errore eliminando', 'error'); } }}
                                                    className="px-2 py-1 rounded-md bg-red-600 text-white text-xs"
                                                >
                                                    Elimina
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {inviteCodes.length === 0 && (
                                        <div className="text-xs text-slate-400">Nessun codice presente.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {profileModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Profilo</h3>
                                <button onClick={() => setProfileModalOpen(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {profileLoading ? (
                                    <div className="text-sm text-slate-400">Caricamento profilo...</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-400">Nome</label>
                                                <input type="text" value={profileFirstName} onChange={(e) => setProfileFirstName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400">Cognome</label>
                                                <input type="text" value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-400">Data di nascita (facoltativo)</label>
                                                <input type="date" value={profileBirthDate} onChange={(e) => setProfileBirthDate(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white" />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm">Tema</span>
                                                <button onClick={onToggleTheme} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md text-sm`}>
                                                    {theme === 'dark' ? 'Light' : 'Dark'}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 mt-4">
                                            <div className="text-xs text-slate-400">Codice invito: <span className="text-white font-mono">{profileInviteCode || '—'}</span></div>
                                            <div className="text-xs text-slate-400">Registrato il: <span className="text-white">{profileRegisteredAt ? new Date(profileRegisteredAt).toLocaleString() : '—'}</span></div>
                                        </div>
                                        <div className="mt-4 border-t border-slate-800 pt-4">
                                            <h4 className="font-semibold mb-2">Cambia Password</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                <input type="password" placeholder="Nuova password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white" />
                                                <input type="password" placeholder="Conferma password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-md bg-[#4B5563] border border-slate-700 text-white" />
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            if (!newPassword || newPassword.length < 8) { showToast('Password troppo corta', 'error'); return; }
                                                            if (newPassword !== confirmPassword) { showToast('Le password non coincidono', 'error'); return; }
                                                            const { error } = await supabase.auth.updateUser({ password: newPassword });
                                                            if (error) throw error;
                                                            setNewPassword(''); setConfirmPassword('');
                                                            showToast('Password aggiornata', 'success');
                                                        } catch (err) { console.error(err); showToast('Errore aggiornando password', 'error'); }
                                                    }}
                                                    className="px-3 py-2 rounded-md bg-emerald-600 text-white text-sm"
                                                >
                                                    Aggiorna Password
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const { data: userData } = await supabase.auth.getUser();
                                                        const user = userData?.user;
                                                        if (!user) throw new Error('Utente non autenticato');
                                                        const update: { first_name: string | null; last_name: string | null; birth_date: string | null } = {
                                                            first_name: profileFirstName || null,
                                                            last_name: profileLastName || null,
                                                            birth_date: profileBirthDate ? profileBirthDate : null,
                                                        };
                                                        const { error } = await supabase.from('app_users').update(update).eq('id', user.id);
                                                        if (error) throw error;
                                                        setUserFirstName(profileFirstName || '');
                                                        setUserLastName(profileLastName || '');
                                                        showToast('Profilo aggiornato', 'success');
                                                    } catch (err) { console.error(err); showToast('Errore aggiornando profilo', 'error'); }
                                                }}
                                                className="px-3 py-2 rounded-md bg-[#1E43B8] text-white text-sm"
                                            >
                                                Salva Profilo
                                            </button>
                                            <button onClick={handleLogout} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md text-sm flex items-center gap-2`}>
                                                <LogOut className="w-4 h-4" />
                                                Esci
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {usersModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Gestione Utenti e Ruoli</h3>
                                <button onClick={() => setUsersModalOpen(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
                                {appUsers.map(u => (
                                    <div key={u.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-2 rounded-md bg-slate-900 border border-slate-800">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-sm font-mono">{u.email}</span>
                                            {u.created_at && <span className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</span>}
                                            <span className={`text-xs px-2 py-1 rounded ${u.active ? 'bg-green-700 text-white' : 'bg-slate-700 text-white'}`}>{u.active ? 'Attivo' : 'Inattivo'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                                            <select
                                                value={u.role}
                                                onChange={async (e) => { try { const role = e.target.value as AppRole; const { error } = await supabase.from('app_users').update({ role }).eq('id', u.id); if (error) throw error; await fetchAppUsers(); showToast('Ruolo aggiornato', 'success'); } catch (err) { console.error(err); showToast('Errore aggiornando ruolo', 'error'); } }}
                                                className="px-2 py-1 rounded-md bg-[#555D69] text-white text-xs"
                                            >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                onClick={async () => { try { const { error } = await supabase.from('app_users').update({ active: !u.active }).eq('id', u.id); if (error) throw error; await fetchAppUsers(); } catch (err) { console.error(err); showToast('Errore aggiornando', 'error'); } }}
                                                className="px-2 py-1 rounded-md bg-[#555D69] text-white text-xs"
                                            >
                                                {u.active ? 'Disattiva' : 'Attiva'}
                                            </button>
                                            <button
                                                onClick={async () => { if (!confirm('Eliminare utente?')) return; try { const { error } = await supabase.from('app_users').delete().eq('id', u.id); if (error) throw error; await fetchAppUsers(); } catch (err) { console.error(err); showToast('Errore eliminando', 'error'); } }}
                                                className="px-2 py-1 rounded-md bg-red-600 text-white text-xs"
                                            >
                                                Elimina
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {appUsers.length === 0 && (
                                    <div className="text-xs text-slate-400">Nessun utente presente o tabella non configurata.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {settingsModalOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-[#1F293B] text-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-[#1F293B]">
                            <div className="px-6 py-4 flex justify-between items-center">
                                <h3 className="font-semibold text-white">Impostazioni</h3>
                                <button onClick={() => setSettingsModalOpen(false)} className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] px-2 py-1 rounded-md`}>
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Colonna Azioni</span>
                                    <label className="relative inline-flex items-center w-12 h-6 cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={showActions} onChange={(e) => setShowActions(e.target.checked)} />
                                        <span className="block w-12 h-6 rounded-full bg-slate-700 transition-colors peer-checked:bg-green-500"></span>
                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6"></span>
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400">Di default è disabilitata.</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm">Button Esporta CSV</span>
                                    <label className="relative inline-flex items-center w-12 h-6 cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={csvEnabled} onChange={(e) => setCsvEnabled(e.target.checked)} />
                                        <span className="block w-12 h-6 rounded-full bg-slate-700 transition-colors peer-checked:bg-green-500"></span>
                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-6"></span>
                                    </label>
                                </div>
                                <p className="text-xs text-slate-400">Di default è disabilitato.</p>
                            </div>
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
                        <button onClick={() => { setSettingsModalOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800`}>
                            <Settings className="w-4 h-4" />
                            Impostazioni
                        </button>
                                <button onClick={async () => { await fetchProfile(); setProfileModalOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800`}>
                                    <User className="w-4 h-4" />
                                    Profilo
                                </button>
                                <button onClick={async () => { await fetchInviteCodes(); setInviteModalOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800`}>
                                    <GitBranch className="w-4 h-4" />
                                    Codici Invito
                                </button>
                                <button onClick={async () => { await fetchAppUsers(); setUsersModalOpen(true); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800`}>
                                    <Users className="w-4 h-4" />
                                    Gestione Utenti
                                </button>
                            </nav>
                            
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-[#1F293B] text-white rounded-xl shadow-sm border border-[#1F293B] overflow-hidden backdrop-blur-sm">
                    <div className="relative overflow-x-auto touch-pan-x w-full">
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 sm:hidden z-10 bg-gradient-to-r from-[#1F293B] to-transparent"></div>
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 sm:hidden z-10 bg-gradient-to-l from-[#1F293B] to-transparent"></div>
                        <table className="w-full min-w-[900px] sm:min-w-[1024px] text-left border-collapse">
                            <thead>
                                <tr className="bg-green-800 dark:bg-emerald-900 border-b border-green-900 dark:border-emerald-950">
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[96px]">
                                        <GitBranch className="w-4 h-4 inline mr-1" />
                                        <span>Livello</span>
                                    </th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                                        <User className="w-4 h-4 inline mr-1" />
                                        <span>Utente</span>
                                    </th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right whitespace-nowrap min-w-[120px]">
                                        <Minus className="w-4 h-4 inline mr-1" />
                                        <span>Negativo</span>
                                    </th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right whitespace-nowrap min-w-[120px]">
                                        <Shield className="w-4 h-4 inline mr-1" />
                                        <span>Cauzione</span>
                                    </th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right whitespace-nowrap min-w-[120px]">
                                        <Upload className="w-4 h-4 inline mr-1" />
                                        <span>Vers. Sett.</span>
                                    </th>
                                    <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right whitespace-nowrap min-w-[160px]">
                                        <Wallet className="w-4 h-4 inline mr-1" />
                                        <span>Disponibilità Conti Gioco</span>
                                    </th>
                                    <th className="px-6 py-4 text-xs font-semibold text-white uppercase tracking-wider text-right whitespace-nowrap min-w-[120px]">
                                        <Calculator className="w-4 h-4 inline mr-1" />
                                        <span>Risultato</span>
                                    </th>
                                    {showActions && (
                                        <th className="px-4 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center whitespace-nowrap min-w-[96px]">Azioni</th>
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
                                        const included = versInclude[row.id] !== false;
                                        return (
                                            <tr key={row.id} className={`${levelRowBgClass(rowLevel)} hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group`}>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-1 text-xs rounded ${levelBadgeClass(levels[row.id] ?? 'user')}`}>{(levels[row.id] ?? 'user').toUpperCase()}</span>
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'} uppercase whitespace-nowrap`} title={owner ? `Appartiene a: ${(byId[owner.id]?.name ?? '').toUpperCase()} (${owner.level.toUpperCase()})` : undefined}>
                                                <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
                                                    {((childrenOf[row.id] || []).length > 0) ? (
                                                    <button
                                                            onClick={() => setExpanded(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                                            className={`${theme === 'light' ? 'bg-slate-100 text-blue-600 ring-1 ring-blue-300 hover:bg-slate-200' : 'bg-[#555D69] text-white ring-1 ring-[#888F96] hover:opacity-90'} p-1 rounded transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500`}
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
                                                    className={`bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm font-medium ${theme === 'light' ? 'text-black' : 'text-white'} uppercase outline-none transition-all whitespace-nowrap`}
                                                />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-red-400 whitespace-nowrap">
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
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'} whitespace-nowrap`}>
                                                <EditableCell
                                                    type="number"
                                                    value={row.cauzione}
                                                    onSave={(val) => handleUpdate(row.id, 'cauzione', val)}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className={`w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm ${theme === 'light' ? 'text-black' : 'text-white'} text-right font-mono outline-none transition-all`}
                                                />
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'} whitespace-nowrap`}>
                                                {hasChildren ? (
                                                    <span className="font-mono block text-right">{totals!.vers.toFixed(2)}</span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <EditableCell
                                                            type="number"
                                                            value={row.versamenti_settimanali}
                                                            onSave={(val) => handleUpdate(row.id, 'versamenti_settimanali', val)}
                                                            onError={(msg) => showToast(msg, 'error')}
                                                            className={`bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:ring-0 px-2 py-1 text-sm ${theme === 'light' ? 'text-black' : 'text-white'} text-right font-mono outline-none transition-all`}
                                                        />
                                                        <button
                                                            onClick={() => setVersInclude(prev => ({ ...prev, [row.id]: !included }))}
                                                            className={`${included ? 'bg-emerald-600 hover:bg-emerald-500' : (theme === 'light' ? 'bg-slate-300 hover:bg-slate-400 text-black' : 'bg-slate-700 hover:bg-slate-600 text-white)')} text-white px-2 py-1 rounded-md text-xs font-medium transition-colors`}
                                                            title={included ? 'Incluso nel calcolo' : 'Escluso dal calcolo'}
                                                        >
                                                            <span className="hidden sm:inline">{included ? 'Inclusa' : 'Esclusa'}</span>
                                                            {included ? <Check className="w-3 h-3 sm:hidden" /> : <X className="w-3 h-3 sm:hidden" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`px-4 py-2 ${theme === 'light' ? 'text-black' : 'text-white'} whitespace-nowrap`}>
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
                                            <td className="px-6 py-4 text-sm font-bold text-white text-right bg-red-600 font-mono whitespace-nowrap">
                                                {(hasChildren ? totals!.ris : valueOf(row.id).rr).toFixed(2)}
                                            </td>
                                            {showActions && (
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
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
