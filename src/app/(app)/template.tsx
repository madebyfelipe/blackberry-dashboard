/*
 * `template.tsx` remonta a cada navegação (diferente de `layout.tsx`, que
 * persiste) — é o gancho certo para a troca de tela do shell autenticado:
 * o conteúdo novo sobe 5px enquanto aparece, e a sidebar fica parada.
 */
export default function AppTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="animate-page-in flex min-h-0 flex-1 flex-col">{children}</div>;
}
