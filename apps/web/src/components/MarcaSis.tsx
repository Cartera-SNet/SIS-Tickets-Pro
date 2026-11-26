type Props = {
  variante?: 'completa' | 'compacta' | 'icono';
  lema?: string;
  className?: string;
};

export function MarcaSis({ variante = 'compacta', lema, className = '' }: Props) {
  if (variante === 'icono') {
    return (
      <img
        className={`marca-logo-icono ${className}`.trim()}
        src="/sis-logo.jpg"
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
      />
    );
  }

  if (variante === 'completa') {
    return (
      <div className={`marca marca-completa ${className}`.trim()}>
        <img className="marca-logo" src="/sis-logo.jpg" alt="SIS · Servicios Integrales en Sistemas" />
        <div className="marca-producto">
          <strong>MESA DE AYUDA TI</strong>
          {lema ? <em className="marca-lema">{lema}</em> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`marca ${className}`.trim()}>
      <img className="marca-logo" src="/sis-logo.jpg" alt="SIS · Servicios Integrales en Sistemas" />
      <div className="marca-producto">
        <strong>MESA DE AYUDA TI</strong>
        {lema ? <em className="marca-lema">{lema}</em> : null}
      </div>
    </div>
  );
}
