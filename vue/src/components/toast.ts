import { useToast } from 'vue-toast-notification';
import 'vue-toast-notification/dist/theme-bootstrap.css';

const $toast = useToast();

function toast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    $toast.default(message, { position: 'top-right', type });
}

export function showError(error: any): void {
    if (error instanceof Error) {
        toast(error.message, 'error');
    } else if (typeof error === 'string') {
        toast(error, 'error');
    } else {
        toast('An unexpected error occurred.', 'error');
    }
}

export function showInfo(message: string): void {
    toast(message, 'info');
};
