import { useEffect, useRef, useState } from "react";
import { useAnimatedReaction, runOnJS } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Dimensions } from "react-native";
import { storage } from "@/lib/storage";
import { popupEvents } from "@/lib/popup-events";

const STORAGE_KEY = "trial_popup_dismissed";
const FLOOR_MS = 8_000;
const SCROLL_MULTIPLIER = 2.5;

export function useTrialPopupTrigger(scrollY: SharedValue<number>, enabled = true) {
  const screenHeight = Dimensions.get("window").height;
  const [show, setShow] = useState(false);

  const floorElapsed = useRef(false);
  const triggered = useRef(false);
  const queued = useRef(false);

  const isDismissed = storage.getBoolean(STORAGE_KEY) ?? false;

  function maybeShow() {
    if (!enabled || triggered.current || isDismissed) return;
    if (!floorElapsed.current) {
      queued.current = true;
      return;
    }
    triggered.current = true;
    setTimeout(() => setShow(true), 700);
  }

  // 8-second floor timer
  useEffect(() => {
    if (!enabled || isDismissed) return;
    const timer = setTimeout(() => {
      floorElapsed.current = true;
      if (queued.current) maybeShow();
    }, FLOOR_MS);
    return () => clearTimeout(timer);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll depth signal — runs on UI thread, bridges to JS via runOnJS
  useAnimatedReaction(
    () => (enabled ? scrollY.value : 0),
    (value) => {
      if (enabled && value >= screenHeight * SCROLL_MULTIPLIER) {
        runOnJS(maybeShow)();
      }
    },
    [screenHeight, enabled]
  );

  // Menu-tap signal
  useEffect(() => {
    if (!enabled || isDismissed) return;
    return popupEvents.subscribe(maybeShow);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    setShow(false);
    storage.set(STORAGE_KEY, true);
  }

  return { show, dismiss };
}
