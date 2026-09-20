interface BadgeProps {
  variant: "success" | "warning" | "error" | "neutral" | "info";
  label: string;
}

const styles: Record<BadgeProps["variant"], string> = {
  success: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  warning: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
  error: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  neutral: "bg-[#f4f4f5] text-[#52525b] border-[#e4e4e7]",
  info: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
};

export default function Badge({ variant, label }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 sm:px-1.5 sm:py-0.5 text-[11px] font-medium rounded-[3px] border ${styles[variant]}`}
    >
      {label}
    </span>
  );
}
