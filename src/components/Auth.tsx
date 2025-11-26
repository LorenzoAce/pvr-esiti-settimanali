import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, Eye, EyeOff, Sun, Moon } from 'lucide-react';

export function Auth({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Controlla la tua email per il link di conferma!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error: unknown) {
            let errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'Credenziali di accesso non valide';
            } else if (errorMessage.includes('Email not confirmed')) {
                errorMessage = 'Email non confermata';
            } else if (errorMessage.includes('User already registered')) {
                errorMessage = 'Utente già registrato';
            } else if (errorMessage.includes('Password should be at least')) {
                errorMessage = 'La password deve essere di almeno 6 caratteri';
            }
            setMessage(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:bg-transparent dark:bg-[none] dark:from-transparent dark:to-transparent flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 dark:bg-[#2A3543] dark:border-[#2A3543]">
                <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <p className="text-sm text-slate-600 italic dark:text-slate-100"></p>
                    <button
                        onClick={onToggleTheme}
                        className={`${theme === 'light' ? 'bg-[#1F293B] hover:bg-[#1b2533]' : 'bg-[#555D69] hover:opacity-90'} text-white border-[0.5px] border-[#888F96] flex items-center gap-2 text-sm font-medium transition-colors px-2 py-1 rounded-md`}
                        title="Tema"
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        {theme === 'dark' ? 'Light' : 'Dark'}
                    </button>
                </div>
            </header>

            {/* Form Container */}
            <div className="flex-1 flex items-center justify-center p-4">
                <div className={`${theme === 'light' ? 'bg-white text-black border border-slate-200' : 'bg-[#1F293B] text-white border border-[#1F293B]'} p-8 rounded-2xl shadow-xl w-full max-w-md`}>
                    {/* Logo e Nome App */}
                    <div className="flex flex-col items-center mb-8">
                        <img src="/logo.png" alt="Logo" className="w-20 h-20 mb-4" />
                        <h1 className={`text-3xl font-bold ${theme === 'light' ? 'text-black' : 'text-white'}`}>PVR - Esiti Settimanali</h1>
                    </div>

                    <p className={`${theme === 'light' ? 'text-black' : 'text-slate-300'} text-center mb-8`}>
                        {isSignUp ? 'Registrati per iniziare' : 'Accedi per accedere alla tua dashboard'}
                    </p>

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${theme === 'light' ? 'text-black' : 'text-white'}`}>Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all ${theme === 'light' ? 'border-slate-300 bg-white text-black placeholder:text-slate-500' : 'border-slate-200 bg-[#4B5563] text-white placeholder:text-white'}`}
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${theme === 'light' ? 'text-black' : 'text-white'}`}>Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none transition-all ${theme === 'light' ? 'border-slate-300 bg-white text-black placeholder:text-slate-500' : 'border-slate-200 bg-[#4B5563] text-white placeholder:text-white'}`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'light' ? 'text-slate-600 hover:text-black' : 'text-white/80 hover:text-white'}`}
                                    aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-sm ${message.includes('Check') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                {message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${isSignUp ? 'bg-[#079765] hover:bg-[#067a51]' : 'bg-[#1E43B8] hover:bg-[#1a3a9e]'}`}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                isSignUp ? 'Registrati' : 'Accedi'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-300">
                        {isSignUp ? 'Hai già un account?' : "Non hai un account?"}{' '}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-white hover:underline font-medium"
                        >
                            {isSignUp ? 'Accedi' : 'Registrati'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className={`${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-700'} border-t py-4`}>
                <div className={`w-full px-4 sm:px-6 lg:px-8 text-center text-sm ${theme === 'light' ? 'text-black' : 'text-white'}`}>
                    <p>© 2025 PVR - Esiti Settimanali by Lorenzo Acerbo. Tutti i diritti riservati.</p>
                    <p className={`${theme === 'light' ? 'text-black' : 'text-slate-400'} mt-1`}>Beta version 1.00</p>
                </div>
            </footer>
        </div>
    );
}
