const express = require('express')
const app = express()
const port = 3001

// Load environment variables
require('dotenv').config({ path: '.env.local' })

app.use(express.json())

// API endpoint to serve metro data from environment variable
app.get('/api/metro-data', (req, res) => {
  try {
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
})

app.listen(port, () => {
  console.log(`Metro data API server running on http://localhost:${port}`)
})
