// OpenWeatherMap — free tier, no OAuth, just API key
const axios = require('axios');
const db = require('../db');

async function fetchWeather(lat, lon, city) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const [current, forecast] = await Promise.all([
      axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=imperial`),
      axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=imperial&cnt=8`),
    ]);
    const c = current.data;
    return {
      city: city || c.name,
      temp: Math.round(c.main.temp),
      feels_like: Math.round(c.main.feels_like),
      description: c.weather[0].description,
      icon: c.weather[0].icon,
      humidity: c.main.humidity,
      wind: Math.round(c.wind.speed),
      forecast: forecast.data.list.map(f => ({
        time: f.dt,
        temp: Math.round(f.main.temp),
        description: f.weather[0].description,
        icon: f.weather[0].icon,
      })),
    };
  } catch (e) { console.error('Weather:', e.message); return null; }
}

module.exports = { fetchWeather, isConfigured: () => !!process.env.OPENWEATHER_API_KEY };
