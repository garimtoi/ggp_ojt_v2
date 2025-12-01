// OJT Master v2.3.0 - Toast Context

import { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';

const ToastContext = createContext(null);

// Toast helper object for use outside of React components
export const Toast = {
  success(message) {
    toast.success(message, { duration: 3000 });
  },
  error(message) {
    toast.error(message, { duration: 5000 });
  },
  warning(message) {
    toast(message, { duration: 4000, icon: '⚠️' });
  },
  info(message) {
    toast(message, { duration: 3000, icon: 'ℹ️' });
  },
  loading(message) {
    return toast.loading(message);
  },
  dismiss(toastId) {
    if (toastId) toast.dismiss(toastId);
  },
  promise(promise, messages) {
    return toast.promise(promise, messages);
  },
};

export function ToastProvider({ children }) {
  return (
    <ToastContext.Provider value={Toast}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#333',
            color: '#fff',
            maxWidth: '500px',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
