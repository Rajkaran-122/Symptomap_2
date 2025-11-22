// Web Worker for heavy outbreak processing computations
// This runs in a separate thread to avoid blocking the main UI

// DBSCAN clustering algorithm implementation
function dbscan(points, eps, minPts) {
  const clusters = [];
  const visited = new Set();
  const noise = new Set();
  
  function getNeighbors(pointIndex) {
    const neighbors = [];
    const point = points[pointIndex];
    
    for (let i = 0; i < points.length; i++) {
      if (i === pointIndex) continue;
      
      const distance = Math.sqrt(
        Math.pow(point.latitude - points[i].latitude, 2) +
        Math.pow(point.longitude - points[i].longitude, 2)
      );
      
      if (distance <= eps) {
        neighbors.push(i);
      }
    }
    
    return neighbors;
  }
  
  function expandCluster(pointIndex, neighbors, clusterId) {
    clusters[clusterId] = clusters[clusterId] || [];
    clusters[clusterId].push(pointIndex);
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighborIndex = neighbors[i];
      
      if (!visited.has(neighborIndex)) {
        visited.add(neighborIndex);
        const neighborNeighbors = getNeighbors(neighborIndex);
        
        if (neighborNeighbors.length >= minPts) {
          neighbors.push(...neighborNeighbors);
        }
      }
      
      if (!clusters.some(cluster => cluster.includes(neighborIndex))) {
        clusters[clusterId].push(neighborIndex);
      }
    }
  }
  
  let clusterId = 0;
  
  for (let i = 0; i < points.length; i++) {
    if (visited.has(i)) continue;
    
    visited.add(i);
    const neighbors = getNeighbors(i);
    
    if (neighbors.length < minPts) {
      noise.add(i);
    } else {
      expandCluster(i, neighbors, clusterId);
      clusterId++;
    }
  }
  
  return {
    clusters: clusters.map((cluster, index) => ({
      id: index,
      points: cluster.map(pointIndex => points[pointIndex]),
      center: calculateClusterCenter(cluster.map(pointIndex => points[pointIndex])),
      size: cluster.length
    })),
    noise: Array.from(noise).map(pointIndex => points[pointIndex])
  };
}

function calculateClusterCenter(points) {
  const latSum = points.reduce((sum, point) => sum + point.latitude, 0);
  const lngSum = points.reduce((sum, point) => sum + point.longitude, 0);
  
  return {
    latitude: latSum / points.length,
    longitude: lngSum / points.length
  };
}

// K-means clustering algorithm
function kmeans(points, k, maxIterations = 100) {
  // Initialize centroids randomly
  let centroids = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * points.length);
    centroids.push({
      latitude: points[randomIndex].latitude,
      longitude: points[randomIndex].longitude
    });
  }
  
  let clusters = [];
  let iterations = 0;
  
  while (iterations < maxIterations) {
    // Assign points to nearest centroid
    clusters = Array(k).fill().map(() => []);
    
    points.forEach((point, pointIndex) => {
      let minDistance = Infinity;
      let nearestCentroid = 0;
      
      centroids.forEach((centroid, centroidIndex) => {
        const distance = Math.sqrt(
          Math.pow(point.latitude - centroid.latitude, 2) +
          Math.pow(point.longitude - centroid.longitude, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestCentroid = centroidIndex;
        }
      });
      
      clusters[nearestCentroid].push(pointIndex);
    });
    
    // Update centroids
    const newCentroids = centroids.map((_, centroidIndex) => {
      const clusterPoints = clusters[centroidIndex].map(index => points[index]);
      
      if (clusterPoints.length === 0) {
        return centroids[centroidIndex]; // Keep old centroid if no points assigned
      }
      
      return calculateClusterCenter(clusterPoints);
    });
    
    // Check for convergence
    const converged = centroids.every((centroid, index) => {
      const newCentroid = newCentroids[index];
      const distance = Math.sqrt(
        Math.pow(centroid.latitude - newCentroid.latitude, 2) +
        Math.pow(centroid.longitude - newCentroid.longitude, 2)
      );
      return distance < 0.001; // Convergence threshold
    });
    
    centroids = newCentroids;
    iterations++;
    
    if (converged) break;
  }
  
  return {
    clusters: clusters.map((cluster, index) => ({
      id: index,
      points: cluster.map(pointIndex => points[pointIndex]),
      center: centroids[index],
      size: cluster.length
    })),
    centroids,
    iterations
  };
}

// Risk score calculation
function calculateRiskScore(outbreak) {
  const {
    caseCount,
    severityLevel,
    populationDensity = 1000,
    daysSinceOnset = 7,
    confidenceScore = 0.5
  } = outbreak;
  
  // Base risk from case count and severity
  let riskScore = (caseCount * severityLevel) / 10.0;
  
  // Adjust for population density (higher density = higher risk)
  riskScore *= (1 + (populationDensity / 1000.0));
  
  // Adjust for time (more recent = higher risk)
  riskScore *= (1 + (1.0 / Math.max(daysSinceOnset, 1)));
  
  // Adjust for confidence (lower confidence = lower risk)
  riskScore *= confidenceScore;
  
  // Normalize to 0-1 scale
  return Math.min(riskScore / 100.0, 1.0);
}

// Anomaly detection using z-score
function detectAnomalies(outbreaks, threshold = 2.0) {
  if (outbreaks.length < 3) return [];
  
  // Calculate mean and standard deviation for case counts
  const caseCounts = outbreaks.map(o => o.caseCount);
  const mean = caseCounts.reduce((sum, count) => sum + count, 0) / caseCounts.length;
  const variance = caseCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / caseCounts.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return [];
  
  // Find anomalies
  const anomalies = outbreaks.filter(outbreak => {
    const zScore = Math.abs((outbreak.caseCount - mean) / stdDev);
    return zScore > threshold;
  });
  
  return anomalies;
}

// Heatmap data generation
function generateHeatmapData(outbreaks, bounds, gridSize = 50) {
  const { north, south, east, west } = bounds;
  const latStep = (north - south) / gridSize;
  const lngStep = (east - west) / gridSize;
  
  const heatmapData = [];
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const lat = south + (i * latStep);
      const lng = west + (j * lngStep);
      
      // Calculate intensity for this grid cell
      let intensity = 0;
      outbreaks.forEach(outbreak => {
        const distance = Math.sqrt(
          Math.pow(outbreak.latitude - lat, 2) +
          Math.pow(outbreak.longitude - lng, 2)
        );
        
        // Use inverse distance weighting
        if (distance < 0.1) { // Within 0.1 degrees
          intensity += outbreak.caseCount / (1 + distance * 10);
        }
      });
      
      if (intensity > 0) {
        heatmapData.push({
          latitude: lat,
          longitude: lng,
          intensity: Math.min(intensity, 1.0) // Normalize to 0-1
        });
      }
    }
  }
  
  return heatmapData;
}

// Message handler
self.onmessage = function(e) {
  const { type, payload } = e.data;
  
  try {
    let result;
    
    switch (type) {
      case 'CLUSTER_OUTBREAKS':
        const { outbreaks, algorithm = 'dbscan', params = {} } = payload;
        
        if (algorithm === 'dbscan') {
          const { eps = 0.01, minPts = 3 } = params;
          result = dbscan(outbreaks, eps, minPts);
        } else if (algorithm === 'kmeans') {
          const { k = 10 } = params;
          result = kmeans(outbreaks, k);
        } else {
          throw new Error(`Unknown clustering algorithm: ${algorithm}`);
        }
        break;
        
      case 'CALCULATE_RISK_SCORES':
        result = payload.outbreaks.map(outbreak => ({
          ...outbreak,
          riskScore: calculateRiskScore(outbreak)
        }));
        break;
        
      case 'DETECT_ANOMALIES':
        result = detectAnomalies(payload.outbreaks, payload.threshold);
        break;
        
      case 'GENERATE_HEATMAP':
        result = generateHeatmapData(
          payload.outbreaks,
          payload.bounds,
          payload.gridSize
        );
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    self.postMessage({
      id: e.data.id,
      type: 'SUCCESS',
      result
    });
    
  } catch (error) {
    self.postMessage({
      id: e.data.id,
      type: 'ERROR',
      error: error.message
    });
  }
};
