export default function handler(req, res) {
  try {
    // Read metro data from environment variable at runtime
    const metroData = process.env.VITE_METEO_DATA
    
    if (!metroData) {
      return res.status(404).json({ error: 'Metro data not found in environment' })
    }

    // Parse and return the JSON data
    const data = JSON.parse(metroData)
    res.status(200).json(data)
  } catch (error) {
    console.error('Error loading metro data:', error)
    res.status(500).json({ error: 'Failed to load metro data' })
  }
}
