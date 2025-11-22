import { getPool } from '../src/database/connection.js';

async function seedDatabase() {
  const pool = getPool();
  
  try {
    console.log('🌱 Seeding database with sample data...');
    
    // Insert sample outbreak reports
    const sampleOutbreaks = [
      {
        disease_type: 'covid-19',
        latitude: 40.7128,
        longitude: -74.0060,
        case_count: 25,
        severity_level: 3,
        confidence: 0.85,
        symptoms: ['fever', 'cough', 'fatigue'],
        location_name: 'New York City',
        data_source: 'sample'
      },
      {
        disease_type: 'influenza',
        latitude: 34.0522,
        longitude: -118.2437,
        case_count: 15,
        severity_level: 2,
        confidence: 0.75,
        symptoms: ['fever', 'body_aches'],
        location_name: 'Los Angeles',
        data_source: 'sample'
      },
      {
        disease_type: 'measles',
        latitude: 51.5074,
        longitude: -0.1278,
        case_count: 8,
        severity_level: 4,
        confidence: 0.90,
        symptoms: ['rash', 'fever'],
        location_name: 'London',
        data_source: 'sample'
      },
      {
        disease_type: 'tuberculosis',
        latitude: 35.6762,
        longitude: 139.6503,
        case_count: 12,
        severity_level: 3,
        confidence: 0.80,
        symptoms: ['cough', 'weight_loss'],
        location_name: 'Tokyo',
        data_source: 'sample'
      },
      {
        disease_type: 'malaria',
        latitude: -26.2041,
        longitude: 28.0473,
        case_count: 20,
        severity_level: 4,
        confidence: 0.88,
        symptoms: ['fever', 'chills'],
        location_name: 'Johannesburg',
        data_source: 'sample'
      }
    ];
    
    // Insert sample data
    for (const outbreak of sampleOutbreaks) {
      await pool.query(`
        INSERT INTO outbreak_reports (
          disease_type, latitude, longitude, case_count, 
          severity_level, confidence, symptoms, location_name, data_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        outbreak.disease_type,
        outbreak.latitude,
        outbreak.longitude,
        outbreak.case_count,
        outbreak.severity_level,
        outbreak.confidence,
        outbreak.symptoms,
        outbreak.location_name,
        outbreak.data_source
      ]);
    }
    
    console.log('✅ Database seeded with sample data');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run seeding if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
