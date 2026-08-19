import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

function Panel(props: HTMLAttributes<HTMLDivElement> & { color?: string }) {
  return <div {...props} />;
}

export const ColorPanels = Panel;
export const Dithering = Panel;
export const DotGrid = Panel;
export const DotOrbit = Panel;
export const GodRays = Panel;
export const GrainGradient = Panel;
export const Metaballs = Panel;
export const MeshGradient = Panel;
export const NeuroNoise = Panel;
export const PerlinNoise = Panel;
export const PulsingBorder = Panel;
export const SimplexNoise = Panel;
export const SmokeRing = Panel;
export const Spiral = Panel;
export const StaticMeshGradient = Panel;
export const StaticRadialGradient = Panel;
export const Swirl = Panel;
export const Voronoi = Panel;
export const Waves = Panel;
export const Warp = Panel;
export const Water = Panel;

export type ColorPanelsProps = { color?: string; style?: CSSProperties; children?: ReactNode };
export type DitheringProps = ColorPanelsProps;
export type DotGridProps = ColorPanelsProps;
export type DotOrbitProps = ColorPanelsProps;
export type GodRaysProps = ColorPanelsProps;
export type GrainGradientProps = ColorPanelsProps;
export type MetaballsProps = ColorPanelsProps;
export type MeshGradientProps = ColorPanelsProps;
export type NeuroNoiseProps = ColorPanelsProps;
export type PerlinNoiseProps = ColorPanelsProps;
export type PulsingBorderProps = ColorPanelsProps;
export type SimplexNoiseProps = ColorPanelsProps;
export type SmokeRingProps = ColorPanelsProps;
export type SpiralProps = ColorPanelsProps;
export type StaticMeshGradientProps = ColorPanelsProps;
export type StaticRadialGradientProps = ColorPanelsProps;
export type SwirlProps = ColorPanelsProps;
export type VoronoiProps = ColorPanelsProps;
export type WavesProps = ColorPanelsProps;
export type WarpProps = ColorPanelsProps;
export type WaterProps = ColorPanelsProps;
