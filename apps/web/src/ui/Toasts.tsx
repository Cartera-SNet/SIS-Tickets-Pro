import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export type AvisoToast = {
  id: string;
  titulo: string;
  cuerpo?: string;
  href?: string;
};

type ContextoToasts = {
  avisos: AvisoToast[];
  mostrar: (aviso: Omit<AvisoToast, 'id'> & { id?: string }) => void;
  quitar: (id: string) => void;
};

const Ctx = createContext<ContextoToasts | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<AvisoToast[]>([]);
  const navigate = useNavigate();

  const quitar = useCallback((id: string) => {
    setAvisos((actual) => actual.filter((item) => item.id !== id));
  }, []);

  const mostrar = useCallback(
    (aviso: Omit<AvisoToast, 'id'> & { id?: string }) => {
      const id = aviso.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setAvisos((actual) => [{ id, titulo: aviso.titulo, cuerpo: aviso.cuerpo, href: aviso.href }, ...actual].slice(0, 5));
      window.setTimeout(() => quitar(id), 8000);
    },
    [quitar],
  );

  const valor = useMemo(() => ({ avisos, mostrar, quitar }), [avisos, mostrar, quitar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div className="toast-pila" aria-live="polite">
        {avisos.map((aviso) => (
          <button
            key={aviso.id}
            type="button"
            className="toast-aviso"
            onClick={() => {
              if (aviso.href) {
                navigate(aviso.href);
              }
              quitar(aviso.id);
            }}
          >
            <strong>{aviso.titulo}</strong>
            {aviso.cuerpo ? <span>{aviso.cuerpo}</span> : null}
          </button>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToasts() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useToasts requiere ToastProvider');
  }
  return ctx;
}
