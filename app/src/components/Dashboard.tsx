import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Plus, Trash2, Save, X } from 'lucide-react';
import { Toast, type ToastType } from './Toast';

interface Calculation {
    id: string;
    name: string;
    negativo: number;
    cauzione: number;
    versamenti_settimanali: number;
    disponibilita: number;
    user_id: string;
}

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

export function Dashboard() {
    const [data, setData] = useState<Calculation[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // New row state
    const [newName, setNewName] = useState('');
    const [newNegativo, setNewNegativo] = useState('');
    const [newCauzione, setNewCauzione] = useState('');
    const [newVersamenti, setNewVersamenti] = useState('');
    const [newDisponibilita, setNewDisponibilita] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: calculations, error } = await supabase
                .from('calculations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setData(calculations || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const calculateResult = (neg: number, cauz: number, vers: number) => {
        return neg - cauz - vers;
    };

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
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

            const newRow = {
                user_id: user.id,
                name: newName,
                negativo: -(Math.abs(parseFloat(newNegativo) || 0)),
                cauzione: parseFloat(newCauzione) || 0,
                versamenti_settimanali: parseFloat(newVersamenti) || 0,
                disponibilita: parseFloat(newDisponibilita) || 0,
            };

            const { data: inserted, error } = await supabase
                .from('calculations')
                .insert([newRow])
                .select()
                .single();

            if (error) throw error;

            setData([inserted, ...data]);
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

    const handleUpdate = async (id: string, field: keyof Calculation, value: any) => {
        // Optimistic update for the main list
        let parsedValue = field === 'name' ? value : (parseFloat(value) || 0);
        if (field === 'negativo') {
            parsedValue = -(Math.abs(parsedValue));
        }

        setData(data.map(item =>
            item.id === id ? { ...item, [field]: parsedValue } : item
        ));

        try {
            const { error } = await supabase
                .from('calculations')
                .update({ [field]: parsedValue })
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
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-800">Gestione Cauzioni</h1>
                    <button
                        onClick={handleLogout}
                        className="text-slate-500 hover:text-slate-700 flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Esci
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Actions */}
                <div className="mb-6 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-slate-700">Riepilogo</h2>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4" />
                        Nuova Voce
                    </button>
                </div>

                {/* Add Form Modal/Overlay */}
                {isAdding && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800">Aggiungi Nuova Voce</h3>
                                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleAdd} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Utente</label>
                                    <input
                                        type="text"
                                        required
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nome utente"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Negativo</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newNegativo}
                                        onChange={e => setNewNegativo(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cauzione</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newCauzione}
                                        onChange={e => setNewCauzione(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Vers. Settimanali</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newVersamenti}
                                        onChange={e => setNewVersamenti(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Disponibilità</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={newDisponibilita}
                                        onChange={e => setNewDisponibilita(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="col-span-2 flex justify-end gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsAdding(false)}
                                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Salva
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utente</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Negativo</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Cauzione</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Vers. Sett.</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-blue-600 uppercase tracking-wider text-right bg-blue-50/50">Risultato</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Disponibilità</th>
                                    <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            Caricamento...
                                        </td>
                                    </tr>
                                ) : data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            Nessun dato presente. Aggiungi una nuova voce.
                                        </td>
                                    </tr>
                                ) : (
                                    data.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-4 py-2">
                                                <EditableCell
                                                    type="text"
                                                    value={row.name}
                                                    onSave={(val) => handleUpdate(row.id, 'name', val)}
                                                    validate={(val) => (!val || val.toString().trim() === '') ? 'Il nome non può essere vuoto' : null}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-2 py-1 text-sm font-medium text-slate-900 outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <EditableCell
                                                    type="number"
                                                    value={row.negativo}
                                                    onSave={(val) => handleUpdate(row.id, 'negativo', val)}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-2 py-1 text-sm text-slate-600 text-right font-mono outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <EditableCell
                                                    type="number"
                                                    value={row.cauzione}
                                                    onSave={(val) => handleUpdate(row.id, 'cauzione', val)}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-2 py-1 text-sm text-slate-600 text-right font-mono outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <EditableCell
                                                    type="number"
                                                    value={row.versamenti_settimanali}
                                                    onSave={(val) => handleUpdate(row.id, 'versamenti_settimanali', val)}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-2 py-1 text-sm text-slate-600 text-right font-mono outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-blue-700 text-right bg-blue-50/30 font-mono">
                                                {calculateResult(row.negativo, row.cauzione, row.versamenti_settimanali).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2">
                                                <EditableCell
                                                    type="number"
                                                    value={row.disponibilita}
                                                    onSave={(val) => handleUpdate(row.id, 'disponibilita', val)}
                                                    onError={(msg) => showToast(msg, 'error')}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:ring-0 px-2 py-1 text-sm text-slate-600 text-right font-mono outline-none transition-all"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleDelete(row.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                                                    title="Elimina"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
