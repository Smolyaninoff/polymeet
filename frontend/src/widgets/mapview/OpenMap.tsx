import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetingListItem } from "@/shared/api/schema";

export function OpenMap({ meetings }: { meetings: MeetingListItem[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      center: [30.3351, 59.9343],
      zoom: 11,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
    });
    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    markers.current.forEach((marker) => marker.remove());
    if (!map.current) return;
    const instance = map.current;
    markers.current = meetings.flatMap((meeting) => {
      if (meeting.lat === null || meeting.lon === null) return [];
      const content = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = meeting.title;
      content.append(title, document.createElement("br"), document.createTextNode(meeting.address));
      return [new maplibregl.Marker().setLngLat([meeting.lon, meeting.lat])
        .setPopup(new maplibregl.Popup().setDOMContent(content)).addTo(instance)];
    });
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; };
  }, [meetings]);

  return <div ref={container} className="h-125 w-full overflow-hidden rounded-xl border border-white/10" />;
}
