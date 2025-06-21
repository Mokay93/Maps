export default function parseGPX(gpxText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(gpxText, "text/xml");
  const points = Array.from(xmlDoc.getElementsByTagName("trkpt"));
  const coordinates = points.map((pt) => [
    parseFloat(pt.getAttribute("lat")),
    parseFloat(pt.getAttribute("lon")),
  ]);
  const times = Array.from(xmlDoc.getElementsByTagName("time")).map((el) => el.textContent);
  return {
    coordinates,
    meta: {
      start: times[0] || "N/A",
      end: times[times.length - 1] || "N/A",
      length: coordinates.length,
    },
  };
}
