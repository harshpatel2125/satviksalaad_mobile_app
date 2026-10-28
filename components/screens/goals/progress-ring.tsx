import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ProgressRingProps {
  size: number;
  thickness: number;
  /** 0 to 1. */
  progress: number;
  color: string;
  trackColor: string;
  /** The colour behind the ring, which fills its middle. */
  holeColor: string;
  children?: React.ReactNode;
}

/**
 * A ring drawn with plain views: two half discs swing into view from 12
 * o'clock, one per half, and a disc on top hollows out the middle.
 */
export function ProgressRing({ size, thickness, progress, color, trackColor, holeColor, children }: ProgressRingProps) {
  const half = size / 2;
  const degrees = Math.min(Math.max(progress, 0), 1) * 360;
  const inner = size - thickness * 2;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: half, backgroundColor: trackColor }]} />
      {degrees > 0 && (
        <View style={[s.clip, { left: half, width: half, height: size }]}>
          <View
            style={{
              position: 'absolute',
              left: -half,
              width: half,
              height: size,
              backgroundColor: color,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
              transformOrigin: 'right center',
              transform: [{ rotate: `${Math.min(degrees, 180)}deg` }],
            }}
          />
        </View>
      )}
      {degrees > 180 && (
        <View style={[s.clip, { left: 0, width: half, height: size }]}>
          <View
            style={{
              position: 'absolute',
              left: half,
              width: half,
              height: size,
              backgroundColor: color,
              borderTopRightRadius: half,
              borderBottomRightRadius: half,
              transformOrigin: 'left center',
              transform: [{ rotate: `${degrees - 180}deg` }],
            }}
          />
        </View>
      )}
      <View
        style={[
          s.hole,
          { top: thickness, left: thickness, width: inner, height: inner, borderRadius: inner / 2, backgroundColor: holeColor },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  clip: { position: 'absolute', top: 0, overflow: 'hidden' },
  hole: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
