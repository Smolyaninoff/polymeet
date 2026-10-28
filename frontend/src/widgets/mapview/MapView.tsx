import { useEffect, useRef } from "react";
import { useYandexMaps } from "./useYandexMaps";
import type { MeetingListItem } from "@/shared/api/schema";
import type {
  YandexMapInstance,
  YandexClusterer,
  YandexPlacemark,
} from "@/types/yandex-maps";

interface MapViewProps {
  meetings: MeetingListItem[];
  apiKey: string;
  onMeetingClick?: (id: number) => void;
}

export function MapView({ meetings, apiKey, onMeetingClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const clustererRef = useRef<YandexClusterer | null>(null);
  const ready = useYandexMaps(apiKey);

  // Initialize map once
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const ymaps = window.ymaps;

    mapRef.current = new ymaps.Map(containerRef.current, {
      center: [59.9343, 30.3351],
      zoom: 11,
      controls: ["zoomControl"],
    });

    const mapEl = containerRef.current.querySelector(".ymaps-2-1-79-map") as HTMLElement | null;
    if (mapEl) {
      mapEl.style.filter = "invert(1) hue-rotate(180deg) brightness(0.85) contrast(1.1)";
    }

    return () => {
      mapRef.current?.destroy();
      mapRef.current = null;
      clustererRef.current = null;
    };
  }, [ready]);

  // Update markers when meetings change
  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const ymaps = window.ymaps;

    if (clustererRef.current) {
      mapRef.current.geoObjects.remove(clustererRef.current);
    }

    clustererRef.current = new ymaps.Clusterer({
      preset: "islands#invertedVioletClusterIcons",
      groupByCoordinates: false,
    });

    const placemarks: YandexPlacemark[] = meetings
      .filter((m): m is typeof m & { lat: number; lon: number } => m.lat !== null && m.lon !== null)
      .map((m) => {
        const pm = new ymaps.Placemark(
          [m.lat, m.lon],
          {
            hintContent: m.title,
            balloonContent: `<strong>${m.title}</strong><br/>${m.address}`,
          },
          { preset: "islands#blueDotIcon" }
        );
        pm.events.add("click", () => onMeetingClick?.(m.id));
        return pm;
      });

    clustererRef.current.add(placemarks);
    mapRef.current.geoObjects.add(clustererRef.current);
  }, [ready, meetings, onMeetingClick]);

  return (
    <div
      ref={containerRef}
      className="h-125 w-full overflow-hidden rounded-xl border border-white/10"
    />
  );
}