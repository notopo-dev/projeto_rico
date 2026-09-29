interface BadgeProps {
  variant: "success" | "warning" | "error" | "neutral" | "info";
  label: string;
}

/**
 * Selo de estado.
 *
 * A aparência mora no index.css, nas classes .selo / .selo-*. Aqui
 * fica só a tradução do nome do estado para a classe. Antes as cores
 * estavam escritas neste arquivo em utilitários do Tailwind, e o
 * mesmo par de cores aparecia solto em outras telas — dois sistemas
 * de selo para a mesma coisa. Agora há um só.
 */
const classePorVariante: Record<BadgeProps["variant"], string> = {
  success: "selo-ok",
  warning: "selo-atencao",
  error: "selo-erro",
  neutral: "selo-neutro",
  info: "selo-info",
};

export default function Badge({ variant, label }: BadgeProps) {
  return <span className={`selo ${classePorVariante[variant]}`}>{label}</span>;
}
