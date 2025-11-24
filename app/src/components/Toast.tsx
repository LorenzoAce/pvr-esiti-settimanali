import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-top-2 fade-in duration-300 ${type === 'error'
                ? 'bg-white border-red-100 text-red-800 shadow-red-100'
                : 'bg-white border-green-100 text-green-800 shadow-green-100'
            }`}>
            {type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            <p className="text-sm font-medium">{message}</p>
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
