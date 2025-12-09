#!/usr/bin/env node

/**
 * Simple GeoJSON Data Validation Test
 * Validates that all GeoJSON files exist and are valid
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
    log('green', `✓ ${message}`);
}

function error(message) {
    log('red', `✗ ${message}`);
}

function info(message) {
    log('cyan', `ℹ ${message}`);
}

log('blue', '\n📊 GeoJSON Data Validation Test\n');

const dataFiles = [
    'Disaster_all.geojson',
    'restaurants_all.geojson',
    'ralway_All.geojson',
    'HW_all.geojson',
    'Oya_all.geojson'
];

let passCount = 0;
let failCount = 0;

// Test 1: Check all files exist in public/data/
info('Checking if all GeoJSON files exist...\n');

for (const file of dataFiles) {
    const filePath = path.join(__dirname, 'public', 'data', file);
    
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        success(`${file} (${sizeKB} KB)`);
        passCount++;
    } else {
        error(`${file} - NOT FOUND`);
        failCount++;
    }
}

// Test 2: Validate JSON structure
info('\nValidating JSON structure...\n');

for (const file of dataFiles) {
    const filePath = path.join(__dirname, 'public', 'data', file);
    
    if (!fs.existsSync(filePath)) continue;
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
            const featureCount = data.features.length;
            success(`${file}: Valid GeoJSON with ${featureCount} features`);
            
            // Show sample properties
            if (data.features.length > 0) {
                const firstFeature = data.features[0];
                const props = Object.keys(firstFeature.properties || {}).slice(0, 3).join(', ');
                log('yellow', `  Sample properties: ${props}`);
            }
            passCount++;
        } else {
            error(`${file}: Not a valid FeatureCollection`);
            failCount++;
        }
    } catch (err) {
        error(`${file}: Invalid JSON - ${err.message}`);
        failCount++;
    }
}

// Test 3: Test distance calculation (inline implementation)
info('\nTesting Haversine distance formula...\n');

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.sqrt(a));
    return R * c;
}

const testDist = calculateDistance(6.9271, 80.7789, 7.0000, 80.8000);
if (testDist > 8 && testDist < 10) {
    success(`Haversine formula: ${testDist.toFixed(2)} km (expected ~9.2 km)`);
    passCount++;
} else {
    error(`Haversine formula: ${testDist.toFixed(2)} km (expected ~9.2 km)`);
    failCount++;
}

// Summary
log('blue', '\n' + '='.repeat(50));
log('cyan', '\n📈 Test Summary:\n');
log('green', `  Passed: ${passCount}`);
log('red', `  Failed: ${failCount}`);
log('cyan', `  Total:  ${passCount + failCount}`);

if (failCount === 0) {
    log('green', '\n✨ All tests passed! GeoJSON files ready for use.\n');
    log('cyan', '🚀 Chatbot can now:');
    log('cyan', '   • Load Disaster_all.geojson for disaster queries');
    log('cyan', '   • Load restaurants_all.geojson for restaurant searches');
    log('cyan', '   • Load ralway_All.geojson for transportation info');
    log('cyan', '   • Load HW_all.geojson for road/highway data');
    log('cyan', '   • Load Oya_all.geojson for river/water data');
} else {
    log('red', '\n⚠️  Some tests failed. Please check the files above.\n');
}

log('blue', '\n' + '='.repeat(50) + '\n');
