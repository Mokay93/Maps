import React, { useEffect, useRef, useState } from "react";
import parseGPX from "./gpxParser";

export default function App() {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [route, setRoute] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [routeInfo, setRouteInfo] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const currentRouteRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [savedRoutes, setSavedRoutes] = useState([]);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);
  const [ymapsLoaded, setYmapsLoaded] = useState(false);

  useEffect(() => {
    window.ymaps.ready(() => {
      setYmapsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (ymapsLoaded && mapRef.current && !map) {
      const newMap = new window.ymaps.Map(mapRef.current, {
        center: [55.76, 37.64],
        zoom: 10,
        controls: ['zoomControl', 'fullscreenControl']
      });
      setMap(newMap);
      setupMapClickHandler(newMap);
    }

    return () => {
      if (map) {
        map.destroy();
      }
    };
  }, [ymapsLoaded, mapRef, map]);

  useEffect(() => {
    currentRouteRef.current = route;
  }, [route]);

  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  useEffect(() => {
    try {
      const storedRoutes = localStorage.getItem('savedRoutes');
      if (storedRoutes) {
        setSavedRoutes(JSON.parse(storedRoutes));
      }
    } catch (error) {
      console.error("Failed to load routes from localStorage:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('savedRoutes', JSON.stringify(savedRoutes));
    } catch (error) {
      console.error("Failed to save routes to localStorage:", error);
    }
  }, [savedRoutes]);

  const setupMapClickHandler = (mapInstance) => {
    mapInstance.events.add('click', (e) => {
      if (isDrawingRef.current) {
        const coords = e.get('coords');
        
        let currentCoordinates = [];

        
        if (polylineRef.current) {
          currentCoordinates = polylineRef.current.geometry.getCoordinates();
        }
        
        
        currentCoordinates.push(coords);

        if (polylineRef.current) {
          polylineRef.current.geometry.setCoordinates(currentCoordinates);
          setRoute(polylineRef.current); 
        } else {
          const newPolyline = new window.ymaps.Polyline(
            currentCoordinates,
            {
              balloonContent: "Маршрут"
            },
            {
              strokeColor: "#3b82f6",
              strokeWidth: 4,
              strokeStyle: 'solid'
            }
          );
          mapInstance.geoObjects.add(newPolyline);
          polylineRef.current = newPolyline; // Сохраняем ссылку на полилинию
          setRoute(newPolyline); // Обновляем состояние 'route', чтобы другие части UI могли отреагировать
        }

        // Добавляем маркер
        const newMarker = new window.ymaps.Placemark(
          coords,
          {
            balloonContent: "Точка маршрута"
          },
          {
            preset: 'islands#blueDotIcon'
          }
        );
        
        mapInstance.geoObjects.add(newMarker);
        markersRef.current.push(newMarker);

        console.log('Point added and polyline updated:', coords);
        updateRouteInfo(polylineRef.current);
      }
    });
  };

  const updateRouteInfo = (currentRoute) => {
    if (currentRoute) {
      const length = currentRoute.geometry.getDistance();
      setRouteInfo({
        start: currentRoute.geometry.getCoordinates().length > 0 ? currentRoute.geometry.getCoordinates()[0].join(', ') : 'N/A',
        end: currentRoute.geometry.getCoordinates().length > 0 ? currentRoute.geometry.getCoordinates()[currentRoute.geometry.getCoordinates().length - 1].join(', ') : 'N/A',
        length: currentRoute.geometry.getCoordinates().length,
        distance: length.toFixed(2) 
      });
    }
  };

  // NEW useEffect for multi-router and markers display
  useEffect(() => {
    if (route) {
      const currentCoordinates = route.geometry.getCoordinates();

      // Маркеры нужно добавлять и удалять явно, так как они не управляются polylineRef
      // Если route не null, значит есть активный маршрут. Добавляем маркеры.
      markersRef.current.forEach(marker => map.geoObjects.add(marker));
      updateRouteInfo(route);
    } else {
      // Если маршрута нет, очищаем только информацию о маршруте и оценки, объекты на карте
      // будут очищены принудительно функциями startDrawing, clearMapAndReset, handleFileUpload
      setRouteInfo(null);
    }
  }, [route, map]);

  const calculateRouteEstimates = async (coordinates) => {
    if (!map || coordinates.length < 2) {
      return;
    }
    // Здесь может быть логика для расчета маршрута, если она потребуется в будущем.
    // Сейчас она удалена, чтобы откатить изменения.
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const text = await file.text();
      const { coordinates, meta } = parseGPX(text);
      
      if (map) {
        map.geoObjects.removeAll(); // Очищаем всю карту
        markersRef.current = []; // Очищаем массив ссылок на маркеры

        const polyline = new window.ymaps.Polyline(coordinates, {}, {
          strokeColor: "#3b82f6",
          strokeWidth: 4,
        });
        map.geoObjects.add(polyline);
        polylineRef.current = polyline;
        setRoute(polyline); // Обновляем состояние route
        map.setBounds(polyline.geometry.getBounds());

        // Добавляем маркеры для загруженного GPX и сохраняем ссылки
        coordinates.forEach(coord => {
          const newMarker = new window.ymaps.Placemark(coord, {},
            {
              preset: 'islands#blueDotIcon',
            }
          );
          map.geoObjects.add(newMarker);
          markersRef.current.push(newMarker);
        });
      }
    }
  };

  const startDrawing = () => {
    if (map) {
      // Если есть существующая полилиния, удаляем ее с карты
      if (polylineRef.current) {
        map.geoObjects.remove(polylineRef.current);
        polylineRef.current = null;
      }
      // Очищаем существующие маркеры с карты и из ссылки
      markersRef.current.forEach(marker => map.geoObjects.remove(marker));
      markersRef.current = [];

      setIsDrawing(true);
      setRoute(null); // Сбрасываем состояние route
      setRouteInfo(null);
    }
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    if (polylineRef.current) {
      setRouteName("Новый маршрут"); // Устанавливаем название по умолчанию
      setRoute(polylineRef.current); // Сохраняем завершенный маршрут в состоянии route
      updateRouteInfo(polylineRef.current);
    }
  };

  const clearMapAndReset = () => {
    if (map) {
      map.geoObjects.removeAll(); // Удаляем все объекты с карты
      map.destroy(); // Уничтожаем текущий экземпляр карты
      setMap(null); // Сбрасываем состояние карты, что вызовет повторную инициализацию через useEffect
      polylineRef.current = null; // Сбрасываем ссылку на полилинию
      markersRef.current = []; // Очищаем массив маркеров
      setRoute(null);
      setIsDrawing(false);
      setRouteName("");
      setRouteInfo(null);
    }
  };

  const undoLastPoint = () => {
    if (polylineRef.current && markersRef.current.length > 0) {
      const currentCoordinates = polylineRef.current.geometry.getCoordinates();
      currentCoordinates.pop(); // Удаляем последнюю координату

      // Удаляем последний маркер с карты и из массива
      const lastMarker = markersRef.current.pop();
      if (map && lastMarker) {
        map.geoObjects.remove(lastMarker);
      }

      if (currentCoordinates.length > 0) {
        polylineRef.current.geometry.setCoordinates(currentCoordinates);
        updateRouteInfo(polylineRef.current);
      } else {
        // Если точек не осталось, удаляем полилинию с карты
        if (map && polylineRef.current) {
          map.geoObjects.remove(polylineRef.current);
        }
        polylineRef.current = null;
        setRoute(null);
        setRouteInfo(null);
      }
    }
  };

  const loadRoute = (routeData) => {
    if (map) {
      map.geoObjects.removeAll(); // Очищаем карту перед загрузкой нового маршрута
      markersRef.current = [];

      const loadedCoordinates = routeData.coordinates;
      const polyline = new window.ymaps.Polyline(loadedCoordinates, {}, {
        strokeColor: "#3b82f6",
        strokeWidth: 4,
      });
      map.geoObjects.add(polyline);
      polylineRef.current = polyline;
      setRoute(polyline);
      setRouteName(routeData.name);
      setIsPublic(routeData.isPublic);
      map.setBounds(polyline.geometry.getBounds());

      // Добавляем маркеры для загруженного маршрута
      loadedCoordinates.forEach(coord => {
        const newMarker = new window.ymaps.Placemark(coord, {},
          {
            preset: 'islands#blueDotIcon',
          }
        );
        map.geoObjects.add(newMarker);
        markersRef.current.push(newMarker);
      });
      updateRouteInfo(polyline);
    }
  };

  const deleteRoute = (id) => {
    
    const updatedSavedRoutes = savedRoutes.filter(route => route.id !== id);
    setSavedRoutes(updatedSavedRoutes);

    // Если удаляемый маршрут отображается на карте, очищаем карту
    if (route && route.properties.get('id') === id) { 
      clearMapAndReset();
    }
    console.log('Route deleted:', id);
  };

  const saveRoute = () => {
    if (polylineRef.current) {
      const routeCoordinates = polylineRef.current.geometry.getCoordinates();
      const newRoute = {
        id: Date.now(),
        name: routeName || "Без названия",
        coordinates: routeCoordinates,
        isPublic: isPublic,
      };
      setSavedRoutes([...savedRoutes, newRoute]);
      console.log("Маршрут сохранен:", newRoute);
    }
  };

  const exportRoutesToCsv = () => {
    const headers = ["ID", "Название", "Координаты", "Публичный"];
    const rows = savedRoutes.map(route => [
      route.id,
      route.name,
      JSON.stringify(route.coordinates),
      route.isPublic ? "Да" : "Нет",
    ]);

    let csvContent = "\ufeff" + headers.join(";") + "\n"; // Добавляем BOM для корректной кодировки в Excel
    rows.forEach(row => {
      csvContent += row.join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'routes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRouteToGpx = () => {
    if (polylineRef.current) {
      const coordinates = polylineRef.current.geometry.getCoordinates();
      const routeNameForGpx = routeName || "Маршрут";

      let gpxContent = 
`<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" creator="Yandex.Maps Route Builder" version="1.1">
  <trk>
    <name>${routeNameForGpx}</name>
    <trkseg>
`;

      coordinates.forEach(coord => {
        gpxContent += `      <trkpt lat="${coord[0]}" lon="${coord[1]}"></trkpt>\n`;
      });

      gpxContent += `    </trkseg>
  </trk>
</gpx>`;

      const blob = new Blob([gpxContent], { type: 'text/xml;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `${routeNameForGpx}.gpx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Построитель маршрутов на Яндекс Картах</h1>
      </header>
      <main className="main-content">
        <section className="map-section">
          <div ref={mapRef} className="map-container" />
          <div className="controls">
            <button className="button primary" onClick={startDrawing} disabled={isDrawing}>
              Начать рисование
            </button>
            <button className="button primary" onClick={finishDrawing} disabled={!isDrawing || !polylineRef.current || polylineRef.current.geometry.getCoordinates().length < 2}>
              Завершить рисование
            </button>
            <button className="button secondary" onClick={undoLastPoint} disabled={!polylineRef.current || polylineRef.current.geometry.getCoordinates().length === 0}>
              Отменить последнюю точку
            </button>
            <button className="button secondary" onClick={clearMapAndReset} disabled={!map || map.geoObjects.getLength() === 0}>
              Очистить карту
            </button>
            <label className="button secondary">
              Загрузить GPX
              <input type="file" accept=".gpx" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </section>

        <section className="info-and-save-section">
          <div className="route-info">
            <h2>Информация о маршруте</h2>
            {routeInfo ? (
              <>
                <p>Начало: {routeInfo.start}</p>
                <p>Конец: {routeInfo.end}</p>
                <p>Точек: {routeInfo.length}</p>
                <p>Длина: {routeInfo.distance} км</p>
              </>
            ) : (
              <p>Нарисуйте маршрут на карте, чтобы увидеть информацию.</p>
            )}
          </div>

          <div className="save-route-section">
            <h2>Сохранить маршрут</h2>
            <input
              type="text"
              className="input-field"
              placeholder="Название маршрута"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Публичный маршрут
            </label>
            <button className="button primary" onClick={saveRoute} disabled={!route}>
              Сохранить маршрут
            </button>
            <button className="button secondary" onClick={exportRoutesToCsv} disabled={savedRoutes.length === 0}>
              Экспортировать все в CSV
            </button>
            <button className="button secondary" onClick={exportRouteToGpx} disabled={!route || route.geometry.getCoordinates().length === 0}>
              Экспортировать в GPX
            </button>
          </div>

          <div className="saved-routes-section">
            <h2>Сохраненные маршруты</h2>
            {savedRoutes.length > 0 ? (
              <ul className="route-list">
                {savedRoutes.map((savedRoute) => (
                  <li key={savedRoute.id} className="route-item">
                    <span>{savedRoute.name} {savedRoute.isPublic ? '(Публичный)' : ''}</span>
                    <div className="route-actions">
                      <button className="button small" onClick={() => loadRoute(savedRoute)}>
                        Загрузить
                      </button>
                      <button className="button small danger" onClick={() => deleteRoute(savedRoute.id)}>
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Сохраненных маршрутов нет.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}