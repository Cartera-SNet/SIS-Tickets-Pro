import { itemPorRuta } from '../navigation';

export function PlaceholderPage({ ruta }: { ruta: string }) {
  const item = itemPorRuta(ruta);
  return (
    <section>
      <h1>{item?.etiqueta ?? 'Pantalla'}</h1>
      <p>{item?.nota ?? 'Esta pantalla todavía no está disponible.'}</p>
    </section>
  );
}
