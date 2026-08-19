import type { SVGProps } from "react";

function Mark({ label, ...props }: SVGProps<SVGSVGElement> & { label: string }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" aria-hidden {...props}>
      <rect width="120" height="40" rx="6" fill="currentColor" opacity="0.08" />
      <text
        x="60"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fontSize="11"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

export const OikovaLightIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Oikova" {...props} />
);
export const SupabaseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Supabase" {...props} />
);
export const TheWeatherCompanyIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Weather" {...props} />
);
export const ShopifyIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Shopify" {...props} />
);
export const SingaporeAirlinesIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Singapore" {...props} />
);
export const VercelLightIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Vercel" {...props} />
);
export const WixBlackIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="Wix" {...props} />
);
export const JohnsonAndJohnsonIcon = (props: SVGProps<SVGSVGElement>) => (
  <Mark label="J&J" {...props} />
);
