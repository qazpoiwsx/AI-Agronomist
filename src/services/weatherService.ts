/**
 * Weather service using Open-Meteo API (free, no API key required for non-commercial use)
 */

export interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  condition: string;
  conditionCode: number;
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const data = await response.json();
    const current = data.current;

    return {
      temp: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      windSpeed: current.wind_speed_10m,
      condition: 'Weather', // Placeholder, will be localized in UI
      conditionCode: current.weather_code,
    };
  } catch (error) {
    console.error('Weather fetch error:', error);
    return null;
  }
}
