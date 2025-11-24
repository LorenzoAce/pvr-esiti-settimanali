import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2 } from 'lucide-react';

export function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [message, setMessage] = useState('');

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
        } catch (error: any) {
            // Traduci i messaggi di errore comuni
            let errorMessage = error.message;
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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
                <h1 className="text-3xl font-bold text-slate-800 mb-2 text-center">
                    {isSignUp ? 'Crea un Account' : 'Benvenuto'}
                </h1>
                <p className="text-slate-500 text-center mb-8">
                    {isSignUp ? 'Registrati per iniziare' : 'Accedi per accedere alla tua dashboard'}
                </p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                            />
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
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            isSignUp ? 'Registrati' : 'Accedi'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {isSignUp ? 'Hai già un account?' : "Non hai un account?"}{' '}
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-blue-600 hover:underline font-medium"
                    >
                        {isSignUp ? 'Accedi' : 'Registrati'}
                    </button>
                </div>
            </div>
        </div>
    );
}
