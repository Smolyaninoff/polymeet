import { useEffect, useState } from "react";

export interface UserLocation {
  lat: number;
  lon: number;
  /** gps — геолокация браузера; default — СПбПУ, если доступ к геолокации не дали */
  source: "gps" | "default";
}

const SPBPU: UserLocation = { lat: 60.0072, lon: 30.3727, source: "default" };

/** Точка для поиска по радиусу; геолокация запрашивается, только когда она нужна. */
export function useUserLocation(enabled: boolean): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(null);

  const supported = "geolocation" in navigator;

  useEffect(() => {
    if (!enabled || location || !supported) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" }),
      () => setLocation(SPBPU),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 }
    );
  }, [enabled, location, supported]);

  if (!enabled) return null;
  return supported ? location : SPBPU;
}
