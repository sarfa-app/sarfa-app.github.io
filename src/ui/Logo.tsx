/** Знак приложения: конверт с зелёным клапаном (иконка A). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0 rounded-[22%]">
      <rect width="512" height="512" fill="#16252C" />
      <rect x="86" y="150" width="340" height="230" rx="22" fill="#EDEFF1" />
      <path d="M86 172 Q86 150 108 150 L404 150 Q426 150 426 172 L270 292 Q256 302 242 292 Z" fill="#2F6F58" />
      <rect x="86" y="338" width="340" height="14" fill="#D5DBDE" />
    </svg>
  );
}
