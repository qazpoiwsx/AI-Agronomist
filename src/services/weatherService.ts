/**
 * Weather service using Open-Meteo API (free, no API key required for non-commercial use)
 */

export interface WeatherData {
  temp?: number;
  humidity?: number;
  precipitation?: number;
  windSpeed?: number;
  condition?: string;
  conditionCode?: number;
  source?: string;
  updatedAt?: string;
  isAvailable?: boolean;
  errorMessage?: string;
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(
      `/api/weather?lat=${lat}&lng=${lng}`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const message = errorJson.message || `Метеосервис временно недоступен (${response.status})`;
      console.warn('Weather fetch warning:', message);
      return {
        isAvailable: false,
        source: errorJson.source || 'Недоступен',
        errorMessage: message,
        updatedAt: new Date().toISOString()
      };
    }

    const data = await response.json();
    const current = data.current;

    if (!current) {
      return {
        isAvailable: false,
        source: data.source || 'Open-Meteo',
        errorMessage: 'Данные метеостанции отсутствуют',
        updatedAt: data.updatedAt || new Date().toISOString()
      };
    }

    return {
      temp: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      condition: current.condition_text || 'Погода',
      conditionCode: current.weather_code ?? 1,
      source: data.source || 'Open-Meteo',
      updatedAt: data.updatedAt || new Date().toISOString(),
      isAvailable: true
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort = error.name === 'AbortError';
    const message = isAbort 
      ? 'Превышено время ожидания метеосервиса (7с)' 
      : (error.message || 'Сетевая ошибка при запросе погоды');
    
    console.warn('Weather fetch unavailable:', message);
    return {
      isAvailable: false,
      source: 'Временно недоступен',
      errorMessage: message,
      updatedAt: new Date().toISOString()
    };
  }
}
