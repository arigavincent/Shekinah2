import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  title: string;
  message?: string;
  tone?: ToastTone;
};

type ToastItem = ToastInput & {
  id: number;
  tone: ToastTone;
};

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

type AdminFeedbackContextValue = {
  showToast: (input: ToastInput) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const AdminFeedbackContext = createContext<AdminFeedbackContextValue | null>(null);

const defaultConfirmState: ConfirmState = {
  open: false,
  title: "",
  message: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  tone: "default"
};

export function AdminFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(defaultConfirmState);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const nextToastId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = nextToastId.current++;
    const tone = input.tone || "info";
    setToasts(current => [...current, { id, tone, ...input }]);
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmState(defaultConfirmState);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setConfirmState({
        open: true,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || "Confirm",
        cancelLabel: options.cancelLabel || "Cancel",
        tone: options.tone || "default"
      });
    });
  }, []);

  useEffect(() => {
    if (!toasts.length) return undefined;

    const timers = toasts.map(item =>
      window.setTimeout(() => dismissToast(item.id), item.tone === "error" ? 5500 : 4200)
    );

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  const value = useMemo(
    () => ({
      showToast,
      confirm
    }),
    [confirm, showToast]
  );

  return (
    <AdminFeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`admin-toast tone-${toast.tone}`}>
            <div>
              <strong>{toast.title}</strong>
              {toast.message ? <p>{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="secondary compact toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              Close
            </button>
          </div>
        ))}
      </div>

      {confirmState.open ? (
        <div className="modal-backdrop" role="presentation" onClick={() => closeConfirm(false)}>
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={event => event.stopPropagation()}
          >
            <p className="eyebrow">Confirm Action</p>
            <h2 id="confirm-dialog-title">{confirmState.title}</h2>
            <p className="muted">{confirmState.message}</p>
            <div className="confirm-actions">
              <button type="button" className="secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={confirmState.tone === "danger" ? "danger" : ""}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminFeedbackContext.Provider>
  );
}

export function useAdminFeedback() {
  const context = useContext(AdminFeedbackContext);
  if (!context) {
    throw new Error("useAdminFeedback must be used within an AdminFeedbackProvider");
  }

  return context;
}
