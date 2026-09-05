import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { AppPopup, PopupActions } from '@/components/ui/AppPopup';

type PopupRequest = {
  title: string;
  message?: string;
  kind: 'info' | 'error' | 'confirm';
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (accepted: boolean) => void;
};

interface PopupContextValue {
  showInfo: (title: string, message?: string) => Promise<void>;
  showError: (title: string, message?: string) => Promise<void>;
  confirm: (title: string, message: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
}

const PopupContext = createContext<PopupContextValue | null>(null);

export function PopupProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState<PopupRequest | null>(null);
  const queueRef = useRef<PopupRequest[]>([]);

  const enqueue = useCallback((request: PopupRequest) => {
    setActive(current => {
      if (current) {
        queueRef.current.push(request);
        return current;
      }
      return request;
    });
  }, []);

  const finish = useCallback((accepted: boolean) => {
    setActive(current => {
      if (!current) return null;
      current.resolve(accepted);
      return queueRef.current.shift() ?? null;
    });
  }, []);

  const showInfo = useCallback((title: string, message?: string) => new Promise<void>(resolve => {
    enqueue({ title, message, kind: 'info', resolve: () => resolve() });
  }), [enqueue]);

  const showError = useCallback((title: string, message?: string) => new Promise<void>(resolve => {
    enqueue({ title, message, kind: 'error', resolve: () => resolve() });
  }), [enqueue]);

  const confirm = useCallback((title: string, message: string, confirmLabel = 'Confirm', cancelLabel = 'Cancel') => new Promise<boolean>(resolve => {
    enqueue({ title, message, kind: 'confirm', confirmLabel, resolve, cancelLabel });
  }), [enqueue]);

  const value = useMemo(() => ({ showInfo, showError, confirm }), [confirm, showError, showInfo]);

  return (
    <PopupContext.Provider value={value}>
      {children}
      <AppPopup
        visible={Boolean(active)}
        title={active?.title ?? ''}
        message={active?.message}
        kind={active?.kind}
        dismissOnBackdrop={active?.kind !== 'confirm'}
        onClose={() => finish(false)}
        footer={active?.kind === 'confirm' ? (
          <PopupActions
            cancelLabel={active.cancelLabel ?? 'Cancel'}
            confirmLabel={active.confirmLabel ?? 'Confirm'}
            onCancel={() => finish(false)}
            onConfirm={() => finish(true)}
          />
        ) : undefined}
      />
    </PopupContext.Provider>
  );
}

export function useAppPopup(): PopupContextValue {
  const value = useContext(PopupContext);
  if (!value) throw new Error('useAppPopup must be used inside PopupProvider');
  return value;
}
