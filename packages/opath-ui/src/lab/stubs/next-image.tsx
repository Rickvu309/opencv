import type { ImgHTMLAttributes } from "react";

export default function Image({
  alt,
  fill,
  src,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) {
  return (
    <img
      alt={alt ?? ""}
      src={typeof src === "string" ? src : undefined}
      {...props}
      style={{
        ...(fill ? { position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" } : {}),
        ...props.style,
      }}
    />
  );
}
