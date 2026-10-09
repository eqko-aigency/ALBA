/** Logotipo "alba" — docs/design/Presentación Logo Alba.pdf. Solo para el
 * wordmark, nunca para texto de interfaz. */
export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-wordmark text-ink ${className}`}>alba</span>;
}
